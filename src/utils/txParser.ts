const RAYDIUM_AUTHORITY_V4 = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export const parseTx = (tx: any) => {
  const transaction = tx.transaction;
  const message = transaction.message;
  const meta = tx.meta;
  const fee = meta.fee / 10 ** 9;
  //console.log("transaction:", transaction);
  const accountKeys = message.accountKeys
    ? message.accountKeys
    : message.staticAccountKeys;
  const signature = transaction.signatures[0];
  const numOfSigners = message.header.numRequiredSignatures;
  const signers = accountKeys.slice(0, numOfSigners);
  //console.log(signers);
  //const instructions = message.instructions;
  const preBalances = meta.preBalances;
  const postBalances = meta.postBalances;
  const preTokenBalances = meta.preTokenBalances;
  const postTokenBalances = meta.postTokenBalances;
  //console.log(preBalances);
  //console.log(postBalances);
  //console.log(preTokenBalances);
  //console.log(postTokenBalances);
  //console.log("accountKeys:", accountKeys);
  const balanceChanges = postBalances.map((balance: any, index: number) => {
    const preBalance = preBalances[index];
    const delta = balance - preBalance;
    return delta;
  });
  //console.log("balanceChanges:", balanceChanges);
  const tokenBalanceChanges = postTokenBalances
    .map((balance: any, index: number) => {
      const accountIndex = balance.accountIndex;
      const mint = balance.mint;
      const preBalance = preTokenBalances.find(
        (balance: any) =>
          balance.accountIndex === accountIndex && balance.mint === mint
      );
      if (!preBalance) {
        const delta = balance.uiTokenAmount.amount;
        if (delta === 0) {
          return null;
        }
        return {
          owner: balance.owner,
          mint: mint,
          amount: balance.uiTokenAmount.amount,
          decimals: balance.uiTokenAmount.decimals,
        };
      } else {
        const delta =
          balance.uiTokenAmount.amount - preBalance.uiTokenAmount.amount;
        if (delta === 0) {
          return null;
        }
        return {
          owner: balance.owner,
          mint: mint,
          amount: delta,
          decimals: preBalance.uiTokenAmount.decimals,
        };
      }
    })
    .filter((change: any) => change !== null);
  //console.log("tokenBalanceChanges:", tokenBalanceChanges);
  const signerTokenBalanceChanges = tokenBalanceChanges.filter(
    (change: any) => change.owner === signers[0]
  );
  const signerSolBalanceChange = balanceChanges[0] / 10 ** 9;
  if (signerTokenBalanceChanges.length === 0) return;
  signerTokenBalanceChanges.forEach((change: any) => {
    console.log(`${signers[0]} ${change.amount < 0 ? "sold" : "bought"}`);
    const amount = change.amount / 10 ** change.decimals;
    console.log(`${Math.abs(amount)} of ${change.mint}`);
  });
  console.log(`for a total of ${Math.abs(signerSolBalanceChange) - fee} SOL`);
  console.log("signature:", signature);
  console.log("--------------------------------");
};
