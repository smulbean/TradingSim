import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("outputs/experiment2/market_dominance.csv")

# Keep only the agents you care about in the story
agents = ["momentum-1", "marketmaker-1", "meanrev-1"]
df = df[df["agentId"].isin(agents)]

world_order = ["TREND", "MEANREV", "CHOP"]
df["world"] = pd.Categorical(df["world"], categories=world_order, ordered=True)
df = df.sort_values(["world", "agentId"])

# ---- Plot A: Sharpe-like by world ----
plt.figure()
for agent in agents:
    sub = df[df["agentId"] == agent]
    plt.errorbar(
        sub["world"].astype(str),
        sub["meanSharpeLike"],
        yerr=sub["ci95SharpeLike"],
        marker="o",
        capsize=4,
        linestyle="none",
        label=agent
    )

plt.axhline(0)
plt.xlabel("World")
plt.ylabel("Sharpe-like")
plt.title("Experiment 2: Regime/Dynamics Dominance (Sharpe-like)")
plt.legend()
plt.grid(True)
plt.savefig("plots/exp2_sharpe_by_world.png", dpi=150)
plt.show()

# ---- Plot B: Mean PnL by world ----
plt.figure()
for agent in agents:
    sub = df[df["agentId"] == agent]
    plt.errorbar(
        sub["world"].astype(str),
        sub["meanPnl"],
        yerr=sub["ci95Pnl"],
        marker="o",
        capsize=4,
        linestyle="none",
        label=agent
    )

plt.axhline(0)
plt.xlabel("World")
plt.ylabel("Mean PnL")
plt.title("Experiment 2: Regime/Dynamics Dominance (Mean PnL)")
plt.legend()
plt.grid(True)
plt.savefig("plots/exp2_pnl_by_world.png", dpi=150)
plt.show()
