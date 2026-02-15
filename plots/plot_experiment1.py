import pandas as pd
import matplotlib.pyplot as plt

# Load data
df = pd.read_csv("outputs/experiment1/sweep_combined.csv")

# Ensure numeric
df["value_dollars_per_unit"] = pd.to_numeric(df["value_dollars_per_unit"])

########################################
# 1) Momentum Sharpe vs Cost
########################################

mom = df[df["agentId"] == "momentum-1"]

plt.figure()
plt.errorbar(
    mom["value_dollars_per_unit"],
    mom["meanSharpeLike"],
    yerr=mom["ci95SharpeLike"],
    marker="o",
    capsize=4
)

plt.xlabel("Cost ($ per unit)")
plt.ylabel("Sharpe-like")
plt.title("Momentum Sharpe vs Transaction Cost")
plt.axhline(0)  # zero Sharpe line
plt.grid(True)
plt.savefig("plots/momentum_sharpe_vs_cost.png", dpi=150)
plt.show()

########################################
# 2) Market Maker Sharpe vs Cost
########################################

mm = df[df["agentId"] == "marketmaker-1"]

plt.figure()
plt.errorbar(
    mm["value_dollars_per_unit"],
    mm["meanSharpeLike"],
    yerr=mm["ci95SharpeLike"],
    marker="o",
    capsize=4
)

plt.xlabel("Cost ($ per unit)")
plt.ylabel("Sharpe-like")
plt.title("Market Maker Sharpe vs Transaction Cost")
plt.axhline(0)
plt.grid(True)
plt.savefig("plots/maker_sharpe_vs_cost.png", dpi=150)
plt.show()

########################################
# 3) PnL vs Turnover × Cost
########################################

# cost-drag proxy already computed in CSV
plt.figure()

for agent in ["momentum-1", "marketmaker-1"]:
    sub = df[df["agentId"] == agent]
    plt.scatter(
        sub["meanCostDragProxy"],
        sub["meanPnl"],
        label=agent
    )

plt.xlabel("Turnover × Cost (Cost Drag Proxy)")
plt.ylabel("Mean PnL")
plt.title("PnL vs Cost Drag")
plt.legend()
plt.grid(True)
plt.savefig("plots/pnl_vs_costdrag.png", dpi=150)
plt.show()
