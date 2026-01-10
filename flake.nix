{
  description = "blog";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.flake-compat.follows = "";
      inputs.gitignore.follows = "";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    process-compose-flake.url = "github:platonic-systems/process-compose-flake";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];

      imports = [
        inputs.git-hooks.flakeModule
        inputs.process-compose-flake.flakeModule
        inputs.treefmt-nix.flakeModule
      ];

      perSystem =
        {
          config,
          pkgs,
          lib,
          ...
        }:
        {
          process-compose.default = {
            cli = {
              options.port = 8081;
            };
            settings.processes = {
              dev = {
                command = ''
                  ${lib.getExe pkgs.pnpm} run dev
                '';
              };
            };
          };

          pre-commit = {
            check.enable = true;
            settings = {
              src = ./.;
              hooks = {
                actionlint.enable = true;
                biome.enable = false;
                treefmt.enable = true;
                typos.enable = true;
              };
            };
          };

          treefmt = {
            projectRootFile = "flake.nix";
            programs = {
              biome = {
                enable = true;
                includes = [
                  "*.astro"
                  "*.cjs"
                  "*.cts"
                  "*.d.cts"
                  "*.d.mts"
                  "*.d.ts"
                  "*.js"
                  "*.json"
                  "*.jsonc"
                  "*.jsx"
                  "*.mjs"
                  "*.mts"
                  "*.ts"
                  "*.tsx"
                ];
                settings.javascript.globals = [ "Astro" ];
              };
              nixfmt.enable = true;
            };
          };

          devShells = {
            default = pkgs.mkShellNoCC {
              packages = with pkgs; [
                nodejs-slim
                pnpm
              ];
              shellHook = config.pre-commit.installationScript;
            };
          };
        };
    };
}
