# Flashbot

Avoid mempool snipers

Inspired by: https://steviep.xyz/txt/compromised and https://www.youtube.com/watch?v=1ve1YIpDs_I

Related docs: https://docs.flashbots.net/ and https://github.com/flashbots/ethers-provider-flashbots-bundle

## Run
1. Install dependencies:
```shell
  npm install
```
2. Create .env file with your values (look .env.example). 
You can use either mnemonics or private keys to initialize the wallets.
3. Adjust parameters in index.ts: PRIORITY_FEE, BASE_FEE, FLASHBOTS_ENDPOINT, CHAIN_ID.
4. Start:
```shell
   npm run start
```