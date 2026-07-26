# トレーサビリティ検査の最小基盤

このリポジトリでは、仕様モデルを正とし、そこから導かれた形式化・検査・実装接地を「導出グラフ」として扱う。これは [Introduction to a Traceability AI Platform](https://speakerdeck.com/orgachem/introduction-to-a-traceability-ai-platform) の、成果物の出発点と到達点を両方向に追い、欠けた接続を日常的に検出する考え方を、小さなローカル検査に落としたものだ。

## 実行経路

```text
Rule ──checks-rule──> Formalization ──uses-artifact──> checker model
                            │                         ▲
                            ├──models-action──> command / event
                            └──asserts-check──> executed check result

abstract Formalization ──┐
                         ├── Refinement ──asserts-check──> concrete assertion
concrete Formalization ──┘
```

`DomainFormalization` は次を明示する。

- `assumptions`: 有限化・抽象化・スケジューリングの前提
- `actionMappings`: 形式モデルの action と Domain Command/Event の接地
- `checks`: 形式化が責任を持つ安定した検査 ID

`DomainFormalizationRefinement` は「抽象モデルの前提が、どの具体モデルの
どの条件に対応するか」を明示する。たとえばテトリスでは
`spawn-open = 1` を、座標モデルの `no (spawn & locked)` に結び、具体
モデルの Alloy assertion を check として指定する。レポートは両端の
形式化とその check が通って初めて refinement を `pass` と表示する。
条件文字列自体はレビュー可能なラベルであり、完全な refinement 証明と
みなさない。

`TetrisAlloy` では `SpawnAvailabilityGrounding` を追加すると、同じ
有限盤面のすべての固定セル配置を純粋な実装アダプタへ渡せる。アダプタは
`{ board, locked } -> { spawnOpen: 0 | 1 }` を返し、自分で出現形状を
計算する。これは Alloy assertion と別の `finite-coordinate-conformance`
証跡であり、対象スコープ外の盤面、テトリミノ、実サービス全体に対する
実装 refinement 証明ではない。

`dspec traceability --markdown <model.pkl>` は、実行結果を突き合わせ、次を区別する。

- `pass`: 宣言された形式化と検査が成功した
- `attention`: 未形式化の Rule、未接地の Command/Event、または不足した検査結果がある
- `fail`: 実行済み検査が失敗した

欠落は失敗と同一視しない。未モデル化の領域を「真である」と誤認しないためのレビューキューである。
明示的な `non_goal` はレビューキューから除外する。これは「まだ接地されていない規則」ではなく、現行スコープから意図的に除いた判断だからである。

Alloy の参照 evaluator が通ったことと Alloy 6 が assertion を実行したことは別の証跡である。通常のレポートには formal tool の状態として `not-requested` を記録し、次のゲートでは solver 実行を必須にできる。

```sh
dspec traceability --gate --require-executed-formal-tools examples/tetris.pkl
```

Alloy 6 が見つからない場合は `skip` と理由を残し、このゲートは失敗する。実行できた場合は各 check の assurance が `alloy6-bounded` となり、ツールのバージョンも evidence に残る。

さらに `formal-mutation` は、正しい assertion を残したまま遷移意味論だけを壊し、solver が反例を返すかを検査する。最初の対応モデルは Tetris Alloy で、出現衝突なのに開始成功を返す変異を検出する。

```sh
dspec formal-mutation --json --require-formal-tools fixtures/tetris-alloy.pkl
```

## テトリスのドッグフーディング

`examples/tetris.pkl` は、重力から固定までを有限状態機械で、盤面占有と回転拒否を Alloy 6 の有限関係モデルで扱う。

- `fixtures/tetris-gravity-behavior.pkl`: 有限経路・全分岐・実装アダプタの接地
- `fixtures/tetris-alloy.pkl`: 4×4 の座標盤面、T テトリミノ、占有排他、衝突回転と左端越境移動の拒否
- `spawn-open-from-coordinates`: 抽象 input `spawn-open = 1` と座標上の空の出現フットプリントを、同じ有限スコープの Alloy check と実装 conformance で接続
- `fixtures/tetris-lifecycle-implementation.mjs#spawnAvailability`: 16 個の固定セル配置で座標参照と照合する、実装側の出現可否アダプタ
- `fixtures/tetris-spawn-game-over-behavior.pkl`: 出現衝突からゲームオーバーへの遷移
- `fixtures/tetris-terminal-game-over-behavior.pkl`: ゲームオーバー後の操作拒否
- `fixtures/tetris-line-clear-alloy.pkl`: 満行の消去と、残ったセルの行圧縮
- `docs/generated/tetris/traceability.md`: 現在の接地済み範囲と未接地のレビューキュー

時相の `fairness` は無限トレースの LTL 公平性を証明する機能ではない。選んだ有限経路が依存するスケジューリング前提を記録し、結果を `finite-scheduled-trace` と表示する。そのため「重力 tick が来続ける」という環境仮定と、モデルが実際に検査した有限トレースを分離して読める。

Alloy 6 が PATH にあれば `verifyTetrisAlloyWithAnalyzer` が生成済みの assertion を有限スコープで実行する。入っていない環境では reference evaluator と生成物同期検査だけが通り、Alloy 実行済みであるという主張にはならない。
