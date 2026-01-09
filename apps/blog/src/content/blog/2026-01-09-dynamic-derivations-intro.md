---
title: "Nixのexperimental-features, dynamic derivationsについて"
pubDatetime: 2026-01-09
description: "Nixの評価/ビルド分離モデルと静的依存関係グラフの仕組み、そしてその限界を解説する"
tags: ["nix", "dynamic-derivations"]
---

Nixのexperimental-featuresにはNix2.33.1現在22種類の実験的機能が定められている。

https://nix.dev/manual/nix/2.33/development/experimental-features

有名なものは `flakes` と `nix-command` だろう。

このシリーズでは残る20種の機能のうち `dynamic-derivations` を中心に
`ca-derivations` と `recursive-nix` について解説する予定である。

なお、nixの実装として `lix` を使っている場合、これらの機能は安定性のために無効化されているため
試す際にはいわゆる CppNix と呼ばれる `nix` が必要であることに注意。

https://git.lix.systems/lix-project/lix/issues/767

## experimental-features

experimental-features とは以下のように不安定な機能と考えられており、いつ使えなくなってもおかしくない機能である。

> Experimental features are considered unstable, which means that they can be changed or removed at any time.

もちろん `flakes` や `nix-command` も該当するが、あまりにも広く使われすぎてしまって
安定しきっていないにもかかわらず大きな変更を加えることが実質不可能となっている。

## RFC

Nixには [RFCs](https://github.com/NixOS/rfcs/) が存在しており、
Nixやnixpkgsに対する新しい機能の提案と議論が活発に行われている。

例えば最近のわかりやすい例を出すと公式のフォーマッタとしてnixfmtを採用するというものがあった。

https://github.com/NixOS/rfcs/blob/master/rfcs/0166-nix-formatting.md

https://github.com/NixOS/rfcs/pull/166

https://github.com/NixOS/rfcs/pull/101

experimental-features になるような機能はすべてRFCによって議論されたものではないが、
大きな変更ほど先にRFCによってコミュニティで揉まれた後実験的機能として実装されることが多い。

## dynamic-derivations

本稿で扱う experimental-features の一つである `dynamic-derivations` は
[RFC 0092](https://github.com/NixOS/rfcs/blob/master/rfcs/0092-plan-dynamism.md)
において提案された機能である。

Dynamic Derivationsとは、ビルド実行中に新たなビルド計画（Derivation）を生成し、動的に依存関係グラフへ組み込む機能である。端的に言うと、現在のNixは事前に定められた静的なビルドグラフしか扱えないが、動的に依存を追加できるようにしようというものである。

なぜこの機能を紹介するのか

1. **現代的な言語エコシステムへの対応**: Node.js、Rust、Goなどの動的な依存関係解決をNix内で自然に扱いたい
2. **IFDの根本的解決**: 評価器をブロックする Import From Derivation (IFD) に頼らない依存解決
3. **インクリメンタルビルドの実現**: Nixを BazelやNinja に比肩する汎用ビルドシステムへ進化させる

## シリーズ概略

1. **本記事**: Nixのビルドモデルと静的グラフの限界
2. **IFD**: 評価中にビルドを走らせる手法とその問題
3. **\*2nixツール**: node2nix等による事前生成アプローチの限界
4. **CA DerivationとRecursive Nix**: Dynamic Derivationsの技術的基盤
5. **RFC 0092の設計**: `.drv`出力と`builtins.outputOf`の仕組み
6. **ユースケースと現状**: NpmNix、MakeNix、そして2026年の実装状況

---

## Nixのビルドモデル: 二つのフェーズ

Nixの最大の特徴は、**評価（Evaluation）**と**ビルド（Build）**という二つのフェーズが厳格に分離されていることにある。

### 評価フェーズ (Evaluation)

評価フェーズでは、Nix式を解釈し、**Derivation**（`.drv`ファイル）を生成する。これは純粋関数的な計算であり、ネットワークアクセスやファイルシステムへの書き込みは行わない。

```bash
$ nix-instantiate '<nixpkgs>' -A hello
/nix/store/i2jqhj3cjvbqd3mfqcclxxjba3xpfgks-hello-2.12.1.drv
```

`nix-instantiate`は評価のみを行い、`.drv`ファイルのパスを返す。この時点ではまだ何もビルドされていない。

### ビルドフェーズ (Build/Realisation)

ビルドフェーズでは、`.drv`ファイルに記述された指示に従い、サンドボックス内で実際の成果物を生成する。

```bash
$ nix-store --realise /nix/store/i2jqhj3cjvbqd3mfqcclxxjba3xpfgks-hello-2.12.1.drv
/nix/store/sbldylj3clbkc0aqvjjzfa6slp4zdvlj-hello-2.12.1
```

通常の`nix-build`は、この二つのフェーズを連続して実行している。

### なぜ分離されているのか

この分離には明確な理由がある。

**評価フェーズの純粋性**

評価フェーズは純粋関数的な計算である。ネットワークアクセスもファイルへの書き込みも行わない。つまり、同じNix式を評価すれば、いつでも・どこでも・誰が実行しても、同じDerivationが生成される。

```
f(nixpkgs, system) → hello-2.12.1.drv  # 常に同じ結果
```

**ソースコードの取得: Fixed-Output Derivation**

ここで疑問が生じる。評価時にネットワークアクセスしないなら、ソースコードはいつダウンロードされるのか？

答えは**Fixed-Output Derivation (FOD)**である。FODは**出力のハッシュを事前に指定する**特殊なDerivationであり、`fetchurl`や`fetchFromGitHub`などのfetcher関数がこれを生成する。

```nix
src = fetchurl {
  url = "https://ftp.gnu.org/gnu/hello/hello-2.12.1.tar.gz";
  hash = "sha256-jZkUKv2SV28wsM18tCqNxoCZmLxdYH2Idh9RLibH2yA=";
};
```

この仕組みの動作は以下の通りである:

1. **評価時**: URLとハッシュがDerivationに記録される（ダウンロードは行わない）
2. **ビルド時**: 実際にファイルをダウンロードする
3. **検証**: ダウンロードしたファイルのハッシュが事前指定と一致しなければ失敗

このようにFODは、評価フェーズの純粋性を保ちながら、ビルドフェーズで外部リソースを取得することを可能にしている。

**静的グラフの利点**

評価が完了した時点で、ビルドに必要な全ての情報が`.drv`ファイルとして確定している。これにより：

- **キャッシュの活用**: Derivationのハッシュが事前に計算できるため、ビルド実行前にキャッシュの有無を確認できる
- **並列ビルド**: 依存関係が静的に判明しているため、独立したDerivationを安全に並列実行できる
- **リモートビルド**: `.drv`ファイルをリモートマシンに送るだけで、同じビルドを再現できる

**もし動的だったら？**

仮にビルド中に依存関係が決まるとすると、ビルドを実行するまでキャッシュが効くかわからず、並列化の計画も立てられない。Nixの再現性は、この「ビルド前に全てが決まっている」という性質に依存している。

---

## Derivationを覗いてみる

Derivationの中身を見ると、Nixのビルドモデルがより明確になる。

### .drvファイルの構造

`.drv`ファイルは[ATerm（Annotated Term）](https://homepages.cwi.nl/~daybuild/daily-books/technology/aterm-guide/aterm-guide.html)形式で保存されている。これはNixが内部で使用するシリアライゼーション形式である。

```bash
$ cat /nix/store/i2jqhj3cjvbqd3mfqcclxxjba3xpfgks-hello-2.12.1.drv
Derive([("out","/nix/store/2bcv91i8fahqghn8dmyr791iaycbsjdd-hello-2.12.2","","")],[("/nix/store/4yhilws0cd5906ifrj766adnqh4f8ybc-hello-2.12.2.tar.gz.drv",["out"]),("/nix/store/dkd7x68qnzz99f3dvmf50ig8xwpvaax8-version-check-hook.drv",["out"]),("/nix/store/pnjvpwgka59d6fwpp9fnz42ll2ai4ffm-stdenv-linux.drv",["out"]),("/nix/store/vwmk63kc9sysjif65h7fdwnqr5h8jfm6-bash-5.3p3.drv",["out"])],["/nix/store/l622p70vy8k5sh7y5wizi5f2mic6ynpg-source-stdenv.sh","/nix/store/shkw4qm9qcw5sc5n1k5jznc83ny02r39-default-builder.sh"],"x86_64-linux","/nix/store/rlq03x4cwf8zn73hxaxnx0zn5q9kifls-bash-5.3p3/bin/bash",["-e","/nix/store/l622p70vy8k5sh7y5wizi5f2mic6ynpg-source-stdenv.sh","/nix/store/shkw4qm9qcw5sc5n1k5jznc83ny02r39-default-builder.sh"],[("NIX_MAIN_PROGRAM","hello"),("__structuredAttrs",""),("buildInputs",""),("builder","/nix/store/rlq03x4cwf8zn73hxaxnx0zn5q9kifls-bash-5.3p3/bin/bash"),("cmakeFlags",""),("configureFlags",""),("depsBuildBuild",""),("depsBuildBuildPropagated",""),("depsBuildTarget",""),("depsBuildTargetPropagated",""),("depsHostHost",""),("depsHostHostPropagated",""),("depsTargetTarget",""),("depsTargetTargetPropagated",""),("doCheck","1"),("doInstallCheck","1"),("mesonFlags",""),("name","hello-2.12.2"),("nativeBuildInputs","/nix/store/qfdf0si45105mh5576w07wgkb8i90hf1-version-check-hook"),("out","/nix/store/2bcv91i8fahqghn8dmyr791iaycbsjdd-hello-2.12.2"),("outputs","out"),("patches",""),("pname","hello"),("postInstallCheck","stat \"${!outputBin}/bin/hello\"\n"),("propagatedBuildInputs",""),("propagatedNativeBuildInputs",""),("src","/nix/store/dw402azxjrgrzrk6j0p66wkqrab5mwgw-hello-2.12.2.tar.gz"),("stdenv","/nix/store/s3w5m3spa1g71hx0yb82lvk6394j3w5j-stdenv-linux"),("strictDeps",""),("system","x86_64-linux"),("version","2.12.2")])
```

この形式は機械処理には効率的だが、人間が読むには適さない。`nix derivation show`を使うと、同じ内容をJSON形式で確認できる。

```bash
$ nix derivation show nixpkgs#hello
```

```json
{
  "/nix/store/zvs7lrrhcqdk4cnhfr48ddypz32c8344-hello-2.12.2.drv": {
    "args": [
      "-e",
      "/nix/store/l622p70vy8k5sh7y5wizi5f2mic6ynpg-source-stdenv.sh",
      "/nix/store/shkw4qm9qcw5sc5n1k5jznc83ny02r39-default-builder.sh"
    ],
    "builder": "/nix/store/rlq03x4cwf8zn73hxaxnx0zn5q9kifls-bash-5.3p3/bin/bash",
    "env": {
      "NIX_MAIN_PROGRAM": "hello",
      "builder": "/nix/store/rlq03x4cwf8zn73hxaxnx0zn5q9kifls-bash-5.3p3/bin/bash",
      "name": "hello-2.12.2",
      "out": "/nix/store/2bcv91i8fahqghn8dmyr791iaycbsjdd-hello-2.12.2",
      "outputs": "out",
      "pname": "hello",
      "src": "/nix/store/dw402azxjrgrzrk6j0p66wkqrab5mwgw-hello-2.12.2.tar.gz",
      "stdenv": "/nix/store/s3w5m3spa1g71hx0yb82lvk6394j3w5j-stdenv-linux",
      "system": "x86_64-linux",
      "version": "2.12.2"
      // ... (省略)
    },
    "inputDrvs": {
      "/nix/store/4yhilws0cd5906ifrj766adnqh4f8ybc-hello-2.12.2.tar.gz.drv": {
        "dynamicOutputs": {},
        "outputs": [
          "out"
        ]
      },
      "/nix/store/pnjvpwgka59d6fwpp9fnz42ll2ai4ffm-stdenv-linux.drv": {
        "dynamicOutputs": {},
        "outputs": [
          "out"
        ]
      },
      // ... (省略)
    },
    "inputSrcs": [
      "/nix/store/l622p70vy8k5sh7y5wizi5f2mic6ynpg-source-stdenv.sh",
      "/nix/store/shkw4qm9qcw5sc5n1k5jznc83ny02r39-default-builder.sh"
    ],
    "name": "hello-2.12.2",
    "outputs": {
      "out": {
        "path": "/nix/store/2bcv91i8fahqghn8dmyr791iaycbsjdd-hello-2.12.2"
      }
    },
    "system": "x86_64-linux"
  }
}
```

注目すべきポイント:

- **inputDrvs**: このDerivationが依存する他のDerivation群
- **outputs**: ビルド成果物の出力パス（評価時点で確定）
- **builder / args**: 実際にビルドを実行するコマンド

### 依存関係グラフ

`nix-store -q --graph`で依存関係をGraphviz形式で出力できる。

```bash
$ nix-store -q --graph /nix/store/...-hello-2.12.1.drv | head -n 3
digraph G {
"zvs7lrrhcqdk4cnhfr48ddypz32c8344-hello-2.12.2.drv" [label = "hello-2.12.2.drv", shape = box, style = filled, fillcolor = "#ff0000"];
"4yhilws0cd5906ifrj766adnqh4f8ybc-hello-2.12.2.tar.gz.drv" -> "zvs7lrrhcqdk4cnhfr48ddypz32c8344-hello-2.12.2.drv" [color = "black"];
...
}
```

この出力をGraphvizで可視化すると、依存関係の構造がより明確になる。

![hello-2.12.1.drvの依存関係グラフ](/assets/images/hello-drv-graph.svg)

`hello`は`bash`、`stdenv`、ソースファイルに直接依存し、`stdenv`はさらに`gcc`や`coreutils`に依存する。実際のグラフは数百ものノードを持つが、構造は同じである。

重要なのは、**このグラフ全体が評価完了時点で静的に確定している**ということである。

---

## 静的グラフの限界

評価/ビルド分離は再現性の基盤だが、現代的なソフトウェア開発においては深刻なボトルネックとなる場合がある。

### 問題1: 評価時間の爆発

全ての依存関係を評価時に計算するコストは、プロジェクトの規模に比例して増大する。

RFC 0092では、この問題を以下のように記述している:

> "the resulting build graphs would become huge...could easily have hundreds of thousands of nodes, far exceeding the graphs typically occurring in deployment."

LinuxカーネルやChromiumのような巨大プロジェクトでインクリメンタルビルドを実現しようとすると、数千個のオブジェクトファイルそれぞれを独立したDerivationとして定義する必要がある。これを静的に行うと、評価だけで数分〜数十分を要することになる。

### 問題2: 動的な依存関係への対応

現代的な言語エコシステム（npm、cargo、go modules）では、依存関係はロックファイルの内容に基づいて決定される。

```
package-lock.json → 依存パッケージA, B, C, ... → それぞれのビルド方法
```

従来のNixでは、この変換を**評価時**に完了させなければならない。つまり「評価を始める前に、全ての依存関係が何であるかを知っていなければならない」という制約がある。

これは鶏と卵の問題を引き起こす:
- ロックファイルの中身を読むには、まずソースを取得する必要がある
- しかしソースの取得はビルドフェーズの仕事である
- 評価フェーズでビルドを走らせる？ → これが後述するIFDの問題に繋がる

### 問題3: インクリメンタルビルドの困難

従来のInput-Addressed Derivationでは、入力が1つ変わるとDerivationのハッシュが連鎖的に変化する。

```
main.c を1行変更
  → main.o のDerivationハッシュが変化
    → プロジェクト全体のDerivationハッシュが変化
      → キャッシュが効かず全再ビルド
```

これは「1ファイルの変更で全再ビルド」を意味し、開発中の反復的なワークフローには適さない。

---

## まとめ

- Nixの**評価/ビルド分離**は再現性を保証する強力な設計である
- しかし「**静的なビルド計画**」という制約は、巨大プロジェクトや動的な言語エコシステムにおいてボトルネックとなる
- **Dynamic Derivations** (RFC 0092) は、この制約を打破するために提案された機能である

次回は、この制約を回避しようとした**Import From Derivation (IFD)**の仕組みと、それがなぜ「アンチパターン」と見なされているのかを解説する。

---

## 参考文献

- [RFC 0092: Plan Dynamism](https://github.com/NixOS/rfcs/blob/master/rfcs/0092-plan-dynamism.md)
- [An early look at Nix Dynamic Derivations - Farid Zakaria's Blog](https://fzakaria.com/2025/03/10/an-early-look-at-nix-dynamic-derivations)
- [Nix Pills - Chapter 6: Our First Derivation](https://nixos.org/guides/nix-pills/our-first-derivation)
