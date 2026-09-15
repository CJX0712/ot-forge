# ot-forge · 最优传输 / Sinkhorn 算法

手写熵正则化最优传输（Entropic Optimal Transport，Cuturi 2013）。零依赖单文件 HTML，浏览器内一键自检 + 无头 Node 断言全绿。

## 这是什么

给定两个离散分布 `a`（源）、`b`（目标）与代价矩阵 `C`，求最优传输计划 `P`：

```
min_P  <P, C> + ε · KL(P ‖ a⊗b)     s.t.  P·1=a,  Pᵀ·1=b
```

最优值即 **Wasserstein 距离**（ε→0 时退化为精确 OT）。这就是 WGAN、域适应、对齐等问题背后的数学核心。

## 算法

- **Sinkhorn 迭代**（平衡）：交替更新 `u, v` 使 `P = diag(u)·K·diag(v)`（其中 `K=exp(-C/ε)`）满足边际约束。
- **log 域实现**（数值稳定为主路径）：`logK=-C/ε`，用 log-sum-exp 更新 `f, g`，避免小 ε 下溢出。
- **exp 域实现**：作为独立交叉验证路径（中等 ε 下与 log 域逐位一致）。
- 附带：代价矩阵、Wasserstein、1D 闭式（排序样本）、`KL(P‖a⊗b)`、边际检查。

引擎暴露在 `globalThis.OT`（见 `<script id="engine">`），可脱离 DOM 在 Node `vm` 中运行。

## 不变量（16/16 无头全绿，见 `_smoke.js`）

| # | 不变量 | 方法 |
|---|--------|------|
| 1 | 1D W2² 闭式 == Sinkhorn | 排序样本独立重算 `Σ(aᵢ-bᵢ)²/N` 对拍 |
| 2 | 1D W1 闭式 == Sinkhorn | `Σ\|aᵢ-bᵢ\|/N` 对拍 |
| 3 | 边际约束 行和==a / 列和==b | 偏差 < 1e-4 |
| 4 | 质量守恒 ΣP==1 | — |
| 5 | P 非负 | 双域均保证 |
| 6 | KL(P‖a⊗b) ≥ 0 | 闭式散度 |
| 7 | 对称 W(X,Y)=W(Y,X) | 2D 代价矩阵对称 |
| 8 | 点质量 W2²=\|μₐ-μ_b\|² 精确 | n=m=1 |
| 9 | 自传输 代价≈0 | 同集合近置换 |
| 10 | 代价随 ε 增大单调上升 | <P,C> 三档 ε |
| 11 | 确定性 同种子逐位一致 | — |
| 12 | log 域 == exp 域 | maxΔ < 1e-6 |
| 13 | ε→0 收敛到近置换 | 良分离离散点 rowmax≈1/N |
| 14 | 正则化代价 = <P,C>+ε·KL | 闭式一致 |
| 15 | 2D 分离 blob W2²≈‖Δμ‖² | 群体真值 36 |
| 16 | 浏览器内 8 项自检（见 UI） | — |

## 使用

直接用浏览器打开 `index.html`：拖动 ε / 迭代 / 样本数滑块，点击「运行 / 自检验」看传输计划热图、散点连线、ε 收敛曲线与 8 项实时自检。

## 验证

```bash
node _smoke.js     # 16 条不变量，输出 _smoke.log
node _uicheck.js   # DOM stub 跑 UI，输出 _uicheck.log
node _probe.js     # ASCII 计划热图 + 收敛曲线，输出 _probe.txt
```

## 工程笔记

- ε 太小（< 样本间距²量级）会数值下溢；log 域稳定，但收敛需更多迭代。
- 经验测度的 Wasserstein 距离含 `1/N` 因子（闭式与 Sinkhorn 口径一致）。
- `gauss(mu,…)` 兼容标量 / 数组 `mu`。

---
MIT © 晨星
