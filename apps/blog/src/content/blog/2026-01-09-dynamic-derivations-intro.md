---
title: "Nixの評価モデルとDynamic Derivationsが必要とされた背景"
pubDatetime: 2026-01-09
description: "Nixの評価/ビルド分離モデルの基礎"
tags: ["nix", "dynamic-derivations"]
---

## はじめに

Nixのexperimental-featuresにはNix 2.33.1現在22種類の実験的機能が定められている。

https://nix.dev/manual/nix/2.33/development/experimental-features

代表的なものは `flakes` と `nix-command` だろう。
これらは実験的機能という位置付けながら、事実上の標準として広く利用されている。

本稿では、残る20種の機能のうち `dynamic-derivations` を中心に、
関連する `ca-derivations` と `recursive-nix` について解説する。

なお、Nixの実装として `lix` を使用している場合、
これらの機能は安定性の観点から削除されている。
本稿の内容を試す際は、upstreamの実装である CppNix が必要となる点に注意されたい。

https://git.lix.systems/lix-project/lix/issues/767

### シリーズ概略

1. 本記事: Nixの評価モデルとDynamic Derivationsが必要とされた背景
2. IFDとlang2nixツール: ワークアラウンドとその限界
3. CA DerivationとRecursive Nix: Dynamic Derivationsの技術的基盤
4. RFC 0092の設計: `.drv`出力と`builtins.outputOf`の仕組み
5. ユースケースと現状: Dynamic Derivationの実践例など

### Experimental Features とは

Experimental features（実験的機能）は、不安定な機能と定義されている。
これは単にバグが多いという意味ではなく、
セマンティクスやCLIインターフェースに破壊的変更が加えられる可能性があることを示唆する。

> Experimental features are considered unstable, which means that they can be changed or removed at any time.

`flakes` や `nix-command` もこれに該当するが、
あまりにも広く普及したため仕様が未確定のまま
大きな変更を加えることが事実上困難となっているのが現状である。

<details>
<summary>RFCによる議論と実験的機能</summary>

Nixには [RFCs](https://github.com/NixOS/rfcs/) が存在し、
新機能の提案と議論が活発に行われている。
例えば、公式フォーマッタとして `nixfmt` を採用する提案（RFC 0166）などが記憶に新しい。

https://github.com/NixOS/rfcs/blob/master/rfcs/0166-nix-formatting.md

https://github.com/NixOS/rfcs/pull/166

https://github.com/NixOS/rfcs/pull/101

すべての実験的機能がRFCを経ているわけではないが、
大きな変更を伴う機能はRFCによるコミュニティでの議論を経て実験的機能として実装される傾向にある。
</details>

### dynamic-derivations の概要

本稿で扱う `dynamic-derivations` は
[RFC 0092](https://github.com/NixOS/rfcs/blob/master/rfcs/0092-plan-dynamism.md)
において提案された機能である。

Dynamic Derivationsはビルド実行中に新たなDerivationを生成し、
依存関係グラフへ動的に組み込むことを可能にする。
従来のNixにおける評価完了時点でビルドグラフが静的に確定しているという前提を拡張し、
あるビルドの出力結果に基づいて次の依存関係を決定する仕組みを提供する。

#### 本機能が解決する課題

主に以下の課題への対応を目的としている。

- 現代的な言語エコシステムへの対応

  Node.js (npm) や Rust (Cargo)、Goなどはソースコード内のロックファイルに基づいて依存関係を決定する。
Dynamic Derivationsを利用することでこれらの動的な依存解決をNixのビルドプロセス内で扱うことが可能になる。

- Import From Derivation (IFD) の代替

  従来、動的な依存解決にはIFDが用いられてきたが、
これは評価処理をブロックするためパフォーマンス上のボトルネックとなっていた。
Dynamic Derivationsは、IFDに依存しない形での動的なグラフ構築を提供する。

- インクリメンタルビルドの粒度向上

  ビルドグラフを動的に生成できるため、
ビルドツールのようにファイル単位など細かい粒度での依存管理が可能となる。
これにより大規模なプロジェクトにおけるビルドの効率化が見込まれる。

---

Dynamic Derivationsを理解するためには、
まずこの機能が拡張しようとしている従来のNixの静的なビルドモデルを正しく理解する必要がある。
そこで本稿ではここからその基礎解説に焦点を当てる。

## Nixのビルドモデル

Nixの最大の特徴は、評価（Evaluation）とビルド（Build/Realisation）
という二つのフェーズが厳格に分離されている点にある。

### 評価フェーズ (Evaluation)

評価フェーズでは、Nix言語で書かれた式を解釈し、
Derivation（`.drv`ファイル）を生成する。
これは純粋関数的な計算でありネットワークアクセスやファイルシステムへの書き込みは一切行わない。

```bash
$ nix-instantiate '<nixpkgs>' -A hello
/nix/store/72pl0rs7xi7vsniia10p7q8vl7f36xaw-hello-2.12.2.drv
```

`nix-instantiate` は評価のみを行い、`.drv`ファイルのパスを返す。
この時点ではビルドは実行されない。

### ビルドフェーズ (Build/Realisation)

ビルドフェーズでは、`.drv`ファイルに記述された指示に従い、
サンドボックス内で実際の成果物を生成する。

```bash
$ nix-store --realise $(nix-instantiate '<nixpkgs>' -A hello)
/nix/store/i3zw7h6pg3n9r5i63iyqxrapa70i4v5w-hello-2.12.2
```

私たちが普段使用する `nix-build` コマンドは、この二つのフェーズを連続して実行するコマンドである。

### 評価の純粋性と Fixed-Output Derivation

評価フェーズは純粋関数的な計算として設計されている。
そのため同じNix式を評価すれば、いつ、どこで、誰が実行しても、
常に同じDerivationが生成されることが保証される。
しかしこの厳格な純粋性は評価中にはネットワークアクセスが一切できないことを意味する。

このままではGitHubや外部サーバーからソースコードを取得することはできない。
この課題を解決するために用意されているのが、Fixed-Output Derivation (FOD) という仕組みである。

FODは、その名の通り出力のハッシュを事前に指定する特殊なDerivationである。
`fetchurl` や `fetchFromGitHub` といった関数は内部的にこのFODを生成している。

```nix
src = fetchurl {
  url = "mirror://gnu/hello/hello-2.12.2.tar.gz";
  hash = "sha256-WpqZbcKSzCTc9BHO6H6S9qrluNE72caBm0x6nc4IGKs=";
};
```

この仕組みによって、外部リソースの取得は以下のように安全に行われる。

1. 評価時には実際のダウンロードは行わず、URLと期待されるハッシュ値のみをDerivationに記録する。
2. ビルド時にサンドボックス内で実際にファイルをダウンロードする。
ファイルのハッシュが事前指定された値と一致するか検証し、異なれば失敗させる。

このようにFODを利用することで、Nixは評価フェーズの純粋性を維持したまま
外部リソースの取得を可能にしている。

### 静的グラフの恩恵と動的化によるトレードオフ

評価フェーズが完了した時点で、ビルドに必要なすべての情報がDerivationとして確定する。
この静的なビルドグラフがNixにシステム的な利点をもたらしている。

まず、ビルドプロセスを実際に実行することなく
ハッシュ値を確認するだけでキャッシュの利用可否を判定できる。
また、依存関係のグラフ構造があらかじめ判明しているため、
スケジューラは効率的な並列化を行い、.drv ファイルを転送するだけで
リモートマシン上に同一のビルド環境を再現することも可能である。

しかし、このモデルを緩和しビルド中に依存関係が変動する動的グラフを許容すれば、
これらの恩恵は損なわれることになる。
次に解決すべき依存関係が不透明な状態では
効率的な並列化計画や事前のキャッシュ確認が機能しなくなるためだ。

さらに重要なトレードオフとして、監査可能性とセキュリティがあげられる。 
静的グラフであれば、Derivationを解析するだけで、
実際にビルドを行う前に何が使われるかを監査でき、
SBOMの生成や脆弱性スキャンを行える。
対して動的グラフでは依存関係はビルドを実行するまで確定しない。
この不確実性は厳格なセキュリティとサプライチェーン管理を求めてNixを採用する環境において、
採用の根拠に関わる課題となりうる。

Nixがこれまで静的モデルを採用し続けてきたのはこのトレードオフに対する工学的な判断の結果である。
動的な柔軟性よりも、結果の再現性と監査可能性をアーキテクチャレベルで保証するという設計方針が
Nixの信頼性を支える基盤となっている。

## Derivationの構造

Derivationの中身を見ることで、Nixのビルドモデルをより明確に理解できる。

### .drvファイルの構造

`.drv`ファイルは
[ATerm（Annotated Term）](https://homepages.cwi.nl/~daybuild/daily-books/technology/aterm-guide/aterm-guide.html)
形式で保存されている。
これはNixの開発初期、ユトレヒト大学/CWI周辺のエコシステムで
利用されていたデータ構造であり、
歴史的経緯から現在もNixの内部シリアライゼーション形式として採用されている。

```bash
$ cat $(nix-instantiate '<nixpkgs>' -A hello)
Derive([("out","/nix/store/i3zw7h6pg3n9r5i63iyqxrapa70i4v5w-hello-2.12.2","","")],[("/nix/store/00kr1572g79ra9m29vxxnrfxm38nb82m-hello-2.12.2.tar.gz.drv",["out"]),...])
```

この形式では我々には読みにくいため、 `nix derivation show` を使用してJSON形式で確認する。

```bash
$ nix derivation show nixpkgs#hello
```

```json
{
  "/nix/store/72pl0rs7xi7vsniia10p7q8vl7f36xaw-hello-2.12.2.drv": {
    "env": {
      "configureFlags": "",
      "nativeBuildInputs": "/nix/store/k9i66zardsrspa4mf0pxqxhbhb48jby1-version-check-hook",
      "out": "/nix/store/i3zw7h6pg3n9r5i63iyqxrapa70i4v5w-hello-2.12.2",
      "pname": "hello",
      "src": "/nix/store/dw402azxjrgrzrk6j0p66wkqrab5mwgw-hello-2.12.2.tar.gz",
      "stdenv": "/nix/store/n1k7lm072r5k3g6v6wb91d2q4sxcxddm-stdenv-linux",
      "system": "x86_64-linux",
      "version": "2.12.2",
      // 省略...
    },
    "inputDrvs": {
      "/nix/store/00kr1572g79ra9m29vxxnrfxm38nb82m-hello-2.12.2.tar.gz.drv": {
        "dynamicOutputs": {},
        "outputs": [
          "out"
        ]
      },
      "/nix/store/i0lswaixfnfr6j3qr9xrij8nq93rp9b5-bash-5.3p3.drv": {
        "dynamicOutputs": {},
        "outputs": [
          "out"
        ]
      },
      "/nix/store/qyk0syp0q2znsv9dpva6krckkcgnxbi1-stdenv-linux.drv": {
        "dynamicOutputs": {},
        "outputs": [
          "out"
        ]
      },
      "/nix/store/yy1bpiw7j0nsygs1iyrz465bplp948ck-version-check-hook.drv": {
        "dynamicOutputs": {},
        "outputs": [
          "out"
        ]
      }
    },
    "inputSrcs": [
      "/nix/store/l622p70vy8k5sh7y5wizi5f2mic6ynpg-source-stdenv.sh",
      "/nix/store/shkw4qm9qcw5sc5n1k5jznc83ny02r39-default-builder.sh"
    ],
    "outputs": {
      "out": {
        "path": "/nix/store/i3zw7h6pg3n9r5i63iyqxrapa70i4v5w-hello-2.12.2"
      }
    },
    "system": "x86_64-linux",
    // 省略...
  }
}
```

この構造において、今回着目すべき箇所はinputDrvs, inputSrcs、そしてoutputsだ。

inputDrvsおよびinputSrcsは依存対象を表しており、
後述する依存関係グラフではそれぞれの各要素がノードとして機能する。

対して outputs はビルド成果物の出力先を示す。
そして重要なのはこのパスが評価完了時点で既に確定しているという点である。
ビルドを実行する前に出力先が一意に定まるこの性質こそが、Nixの決定論的ビルドの核心を成している。

### 依存関係グラフ

`nix-store -q --graph`で依存関係をGraphviz形式で出力できる。

```bash
$ nix-store -q --graph $(nix-instantiate '<nixpkgs>' -A hello) | head -n 3
digraph G {
"72pl0rs7xi7vsniia10p7q8vl7f36xaw-hello-2.12.2.drv" [label = "hello-2.12.2.drv", shape = box, style = filled, fillcolor = "#ff0000"];
"00kr1572g79ra9m29vxxnrfxm38nb82m-hello-2.12.2.tar.gz.drv" -> "72pl0rs7xi7vsniia10p7q8vl7f36xaw-hello-2.12.2.drv" [color = "black"];
...
}
```

この出力をGraphvizで可視化した結果が以下である。

![hello-2.12.2.drvの依存関係グラフ](/assets/images/hello-drv-graph.svg)

<details>
<summary>出力に用いたコマンド</summary>
以下のようなスクリプトを用い、ノードの深さを1に制限した。

```dot
// depth-filter.gvpr
BEG_G {
  int maxdepth = (int)ARGV[0];
  node_t n, m;
  edge_t e;
  int outdeg, changed;
  
  for (n = fstnode($G); n; n = nxtnode(n)) {
    outdeg = 0;
    for (e = fstout(n); e; e = nxtout(e)) outdeg++;
    n.d = (outdeg == 0) ? 0 : -1;
  }
  
  changed = 1;
  while (changed) {
    changed = 0;
    for (n = fstnode($G); n; n = nxtnode(n)) {
      for (e = fstin(n); e; e = nxtin(e)) {
        m = e.tail;
        if (n.d >= 0 && n.d < maxdepth && m.d < 0) {
          m.d = n.d + 1;
          changed = 1;
        }
      }
    }
  }
}
N [$.d < 0] { delete($G, $); }
```

`nix-store -q --graph $(nix-instantiate '<nixpkgs>' -A hello) | gvpr -c -a 2 -f depth-filter.gvpr | dot -Tsvg -o out.svg`
</details>

上図では、`hello` が `bash` や `stdenv`、ソースファイルへ直接依存している様子が見て取れる。
さらに `stdenv` の先には表示されていないが `gcc` や `coreutils` といったツールチェーンが連なる。

実際の完全な依存グラフは数百ものノードに及ぶが、グラフの規模に関わらずこのグラフ全体が評価完了時点で静的に確定している。

## 静的グラフの限界

評価とビルドの厳格な分離は前述の通り再現性とセキュリティの要である。
しかし、元来パッケージのデプロイメントを主眼に設計されたこのモデルは、
現代的なソフトウェア開発サイクルにおいて、構造的なボトルネックを生みだしている。

### 課題1: 粒度と評価コストのトレードオフ

開発中の試行錯誤を高速化するインクリメンタルビルドを実現するには、
オブジェクトファイル単位での細粒度な依存管理が不可欠である。
しかし静的モデルのままこれを模倣しようとすると、評価時間の爆発という壁に突き当たる。
粒度を細かくすれば数十万ノード規模の依存グラフが生成され、
ビルド前の評価フェーズだけで数分から数十分を要してしまう。

一方粒度を粗くすれば、わずか1行の変更でパッケージ全体の再ビルドが発生し開発サイクルは停滞する。
高速なインクリメンタルビルドと現実的な評価時間の両立は、
グラフを事前に全展開しなければならない静的モデルである以上原理的に困難な課題である。

### 課題2: 動的な依存関係への対応

もう一つの壁は、npm、Cargo、Go Modulesといった現代的な言語エコシステムへの対応だ。
これらのツールチェーンでは依存関係はソースコードに含まれるロックファイルの内容に基づいて動的に決定される。

従来のNixモデルにおいて、この挙動は循環参照を引き起こす。 
依存関係を確定させるにはロックファイルの中身が必要だが、
そのロックファイルを読むためにはソースコードを取得しなければならない。 
ソースがなければ依存が決まらず、依存が決まらなければソースを取得できないという構造的な矛盾を
静的グラフモデルは抱えている。

## まとめ

本稿ではNixの評価とビルドの分離と、それを支える静的グラフモデルについて解説した。
この設計は高い再現性と監査可能性を実現する一方、
現代的な言語エコシステムへの追従や大規模ビルドにおいてはかえって制約となっている。

RFC 0092として提案された `Dynamic Derivations` はこの課題を解消するために
グラフ構成を動的に拡張する機能である。
しかしこれは評価時にすべてが決定するという従来の前提を根幹から変更するものである。

次回はDynamic Derivations以前のアプローチとして、
Import From Derivation (IFD) および lang2nix に代表されるコードジェネレーターについて解説する。
これらがどのように静的グラフの制約を回避してきたか、そしてその手法の限界について掘り下げる。

---

## 参考文献

- [RFC 0092: Plan Dynamism](https://github.com/NixOS/rfcs/blob/master/rfcs/0092-plan-dynamism.md)
- [Nix Pills - Chapter 6: Our First Derivation](https://nixos.org/guides/nix-pills/06-our-first-derivation.html)
