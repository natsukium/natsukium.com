---
title: "nix-diff-action: Nix設定変更の影響をプルリクエストで可視化する"
pubDatetime: 2025-12-20
description: "NixOS/nix-darwinの設定変更でどのパッケージが追加・削除・更新されるかをPRコメントで自動表示するGitHub Actionを作成した"
---

## Nixの宣言的設定は「何が変わるか」が見えにくい

Nix は宣言的なパラダイムであり、設定を書けば「どうやって実現するか」は隠蔽される。
これは大きな利点である一方、設定変更の影響範囲が見えにくいという課題がある。

例えば NixOS や nix-darwin で以下のような変更を行ったとする。

```nix
services.nginx.enable = true;
```

このたった1行の変更で、実際には nginx 本体に加え、依存するライブラリやヘルパースクリプトなど多くのパッケージがシステムに追加される。
しかし、コードの diff を見ただけではそれがわからない。

同様に、nixpkgs のリビジョンを更新した場合、どのパッケージのバージョンが上がり、どのパッケージが追加・削除されるのかは、実際にビルドして比較しなければ把握できない。

## 既存の差分ツール

Nix のエコシステムには derivation の差分を表示するツールがいくつか存在する。

[nix-diff](https://github.com/Gabriella439/nix-diff) は derivation ファイルの構造的な差分を表示するツールである。
キャッシュミスの原因調査や、Nix の内部動作を理解するには有用だが、出力される情報量が多く、日常的な差分確認には向かない。

[nvd](https://gitlab.com/khumba/nvd) は closure のバージョン差分を人間が読みやすい形式で表示するツールである。
パッケージの追加・削除・更新がひと目でわかり、実用的な差分確認に適している。

[dix](https://github.com/faukah/dix) は nvd に着想を得て Rust で書かれたツールである。
より高速に動作し、出力形式も洗練されている。

これらのツールはローカルで実行するには便利だが、プルリクエストを作成するたびに手動で実行するのは面倒である。
この不満は以前から [コミュニティでも議論](https://discourse.nixos.org/t/nix-dry-run-report/23894) されており、`nix flake update` がパッケージのバージョン変化を表示してほしいという [要望](https://github.com/NixOS/nix/issues/10015) も出ている。
CI で自動的に差分を取得し、レビュー時に確認できるようにしたい。

## 他のエコシステムとの比較

多くのパッケージマネージャーや IaC ツールでは、変更のプレビューがワークフローに組み込まれている。

[Terraform](https://developer.hashicorp.com/terraform/cli/commands/plan) では `terraform plan` が標準であり、変更を適用する前に必ずプレビューを確認するのが当たり前となっている。
Homebrew では `brew upgrade --dry-run` でドライランができ、Arch Linux では `checkupdates` でビルドなしにアップデート可能なパッケージを一覧表示できる。
[Ansible](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_checkmode.html) でも `--check --diff` オプションでドライランと差分表示が標準で提供されている。

一方 Nix では、前述のツールを使うにしても複数のステップを踏む必要がある（[参考](https://blog.tjll.net/previewing-nixos-system-updates/)）。

```bash
# 1. 現在の状態を記録
current=$(nix build .#nixosConfigurations.myhost.config.system.build.toplevel --print-out-paths)

# 2. 変更を加える
vim flake.nix

# 3. 新しい状態をビルド
new=$(nix build .#nixosConfigurations.myhost.config.system.build.toplevel --print-out-paths)

# 4. 差分を表示
nix store diff-closures $current $new
```

他のツールが「コマンド一発でプレビュー」できるのに対し、Nix では複数のステップを踏む必要がある。

さらに GitOps ワークフロー、つまり flake を Git で管理して PR ベースで更新するような運用では、PR の段階で差分を確認する標準的な方法がない。

## nix-diff-action

そこで [nix-diff-action](https://github.com/natsukium/nix-diff-action) を作成した。
dix を GitHub Actions として使えるようにラップし、PR に自動でコメントを投稿するものである。

基本的な使い方は以下の通りである。

```yaml
name: Nix Diff

on:
  pull_request:

jobs:
  nix-diff:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@main
      - uses: cachix/install-nix-action@main
      - uses: natsukium/nix-diff-action@main
        with:
          attributes: |
            - displayName: my-nixos
              attribute: nixosConfigurations.my-nixos.config.system.build.toplevel
            - displayName: my-macos
              attribute: darwinConfigurations.my-macos.system
```

PR を作成すると、以下のようなコメントが自動で投稿される。

```
CHANGED
[U.] 7zz                        24.09 → 25.00
[U.] grim                       1.4.1 → 1.5.0
[U.] hyprutils                  0.7.1 → 0.8.1

ADDED
[A.] hostname-hostname-debian   3.25

REMOVED
[R.] onefetch                   2.24.0

SIZE: 29.7 GiB → 29.7 GiB
DIFF: -19.3 MiB
```

パッケージの追加・削除・更新が一覧で表示され、closure size の変化も確認できる。

## 複数マシンの並列処理

NixOS と nix-darwin で複数のホストを管理している場合、それぞれに対して差分を取る必要がある。
nix-diff-action は matrix strategy による並列実行をサポートしている。

```yaml
jobs:
  diff:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        host: [host1, host2, host3]
    steps:
      - uses: actions/checkout@main
      - uses: cachix/install-nix-action@main
      - uses: natsukium/nix-diff-action@main
        with:
          mode: diff-only
          attributes: |
            - displayName: ${{ matrix.host }}
              attribute: nixosConfigurations.${{ matrix.host }}.config.system.build.toplevel

  comment:
    needs: diff
    runs-on: ubuntu-latest
    steps:
      - uses: natsukium/nix-diff-action@main
        with:
          mode: comment-only
```

`diff-only` モードで各ホストの差分を並列に取得し、`comment-only` モードで結果を一つのコメントにまとめる。
ホストが増えても実行時間はほぼ一定であり、レビュー時には一箇所ですべての差分を確認できる。

## ユースケース

このアクションは以下のような場面で役立つ。

**dotfiles のレビュー**: 個人の NixOS/nix-darwin 設定を Git で管理している場合、変更の影響範囲を PR 上で確認できる。
私自身、[dotfiles](https://github.com/natsukium/dotfiles) で10台近いマシンを管理しており、このアクションによって変更のレビューが楽になった。

**nixpkgs の更新確認**: flake.lock を更新した際、どのパッケージがどのバージョンに変わるかを事前に把握できる。
意図しないバージョンの変更や、パッケージの追加・削除を見落とすことがなくなる。

**チームでの設定管理**: 複数人で Nix の設定を管理している場合、レビュアーが変更の影響を理解しやすくなる。
コードの diff だけでは伝わらない情報を補完できる。

## 終わりに

Nix の宣言的な設定は強力だが、変更の影響範囲が見えにくいという課題があった。
nix-diff-action により、PR 上で変更の影響を可視化し、レビューの質を向上させることができる。

現在はまだアルファ版であり、API や挙動が変更される可能性がある。
フィードバックや改善の提案があれば [GitHub](https://github.com/natsukium/nix-diff-action) で受け付けている。
