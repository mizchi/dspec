{
  description = "dspec executable specification prototype";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/DeterminateSystems/nixpkgs-weekly/0.1";
    pkfire = {
      url = "git+https://github.com/mizchi/pkfire?ref=refs/tags/pkfire@0.12.3";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, pkfire, ... }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            pnpm
            pkl
            elan
            z3
            tlaplus
            alloy6
            pkfire.packages.${system}.default
          ];

          shellHook = ''
            export PATH="$HOME/.moon/bin:$PATH"
            if ! lean --version >/dev/null 2>&1; then
              elan default leanprover/lean4:v4.31.0 >/dev/null
            fi
            echo "dspec devShell"
            echo "  node    : $(node --version 2>&1 | head -1 || echo not-found)"
            echo "  pnpm    : $(pnpm --version 2>&1 | head -1 || echo not-found)"
            echo "  pkl     : $(pkl --version 2>&1 | head -1 || echo not-found)"
            echo "  elan    : $(elan --version 2>&1 | head -1 || echo not-found)"
            echo "  lean    : $(lean --version 2>&1 | head -1 || echo not-found)"
            echo "  z3      : $(z3 --version 2>&1 | head -1 || echo not-found)"
            echo "  tlasany : $(command -v tlasany 2>/dev/null || echo not-found)"
            echo "  tlc     : $(command -v tlc 2>/dev/null || echo not-found)"
            echo "  alloy6  : $(command -v alloy6 2>/dev/null || echo not-found)"
            echo "  pkf     : $(pkf --version 2>&1 | head -1 || echo 'not-found; install pkfire separately')"
          '';
        };
      });
    };
}
