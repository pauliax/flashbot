require('dotenv').config()

import { providers, Wallet } from "ethers"
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle"

const GWEI = 10n ** 9n
const ETHER = 10n ** 18n

// adjust depending on network congestion
const PRIORITY_FEE = 4
const BASE_FEE = 205

// goerli
const FLASHBOTS_ENDPOINT = 'https://relay-goerli.flashbots.net'
const CHAIN_ID = 5

// mainnet
// const FLASHBOTS_ENDPOINT = 'https://relay.flashbots.net'
// const CHAIN_ID = 1

// Include these as env variables
// https://infura.io <- check out their free tier, create a project, and use the project id
const INFURA_KEY = process.env.INFURA_KEY

// You can use either mnemonic or private key of your wallet
const FUNDING_WALLET_MNEMONIC = process.env.FUNDING_WALLET_MNEMONIC
// const FUNDING_WALLET_PRIVATE_KEY = process.env.FUNDING_WALLET_PRIVATE_KEY

// Compromised wallet
const COMPROMISED_WALLET_MNEMONIC = process.env.COMPROMISED_WALLET_MNEMONIC
// const COMPROMISED_WALLET_PRIVATE_KEY = process.env.COMPROMISED_WALLET_PRIVATE_KEY

if (!(INFURA_KEY || FUNDING_WALLET_MNEMONIC || COMPROMISED_WALLET_MNEMONIC)) {
  console.log('Please include INFURA_KEY, FUNDING_WALLET_MNEMONIC, and COMPROMISED_WALLET_MNEMONIC as env variables.')
  process.exit(1)
}

// Create clients to interact with Infura and wallets
const provider = new providers.InfuraProvider(CHAIN_ID, INFURA_KEY)
const fundingWallet = Wallet.fromMnemonic(FUNDING_WALLET_MNEMONIC, `m/44'/60'/0'/0/0`).connect(provider);
// const fundingWallet = new Wallet(FUNDING_WALLET_PRIVATE_KEY, provider)
const compromisedWallet = Wallet.fromMnemonic(COMPROMISED_WALLET_MNEMONIC, `m/44'/60'/0'/0/0`).connect(provider);
// const compromisedWallet = new Wallet(COMPROMISED_WALLET_PRIVATE_KEY, provider)

// Transaction template
const tx = (args) => ({
  chainId: CHAIN_ID,
  type: 2, // EIP 1559
  maxFeePerGas: GWEI * BigInt(BASE_FEE),
  maxPriorityFeePerGas: GWEI * BigInt(PRIORITY_FEE),
  data: '0x',
  value: 0n,
  ...args
})

/*
  The basic idea here is that you want to you group together the
  following transactions such that no one can get in the middle of
  things and siphon off the assets:
    1. Fund the compromised wallet
    2. Perform all the actions you need on that wallet
    3. Bribe the miner
*/
const bundle = [
  {
    transaction: tx({
      to: '0x123...',
      // There will probably be some ETH left over from this, which will be cleaned out immediately
      value: ETHER / 1000n,
    }),
    signer: fundingWallet
  },
  {
    transaction: tx({
      to: '0x456...',
      // optional gas limit override
      gasLimit: '100...',
      // you can obtain and copy data from Metamask
      data: '0x11111...'
    }),
    signer: compromisedWallet
  },
]


let i = 0
async function main() {
  console.log('Starting flashbot...')

  // Connect to the flashbots relayer --
  // this will communicate your bundle of transactions to miners directly, and will bypass the mempool.
  let flashbotsProvider
  try {
    console.log('Retrieving Flashbots Provider...')
    flashbotsProvider = await FlashbotsBundleProvider.create(provider, fundingWallet, FLASHBOTS_ENDPOINT)
  } catch (err) {
    console.error(err)
  }


  // Every time a new block has been detected, attempt to relay the bundle to miners for the next block
  // Since these transactions aren't in the mempool you need to submit this for every block until it
  //  So you can leave this running until it fills. I am not sure what's the best way to detect whether it's filled.
  provider.on('block', async blockNumber => {
    try {
      const nextBlock = blockNumber + 1
      console.log(`Preparing bundle for block: ${nextBlock}`)

      const signedBundle = await flashbotsProvider.signBundle(bundle)

      console.log('Simulate bundle')
      // const simulateResponse = await txBundle.simulate()
      const simulation = await flashbotsProvider.simulate(
          signedBundle,
          nextBlock
      );
      if ('error' in simulation) {
        console.log('Simulate error')
        console.error(simulation.error)
        process.exit(1)
      }
      console.log('simulation:', simulation)

      console.log('Submitting bundle')
      const txBundle = await flashbotsProvider.sendRawBundle(signedBundle, nextBlock)
      if ('error' in txBundle) {
        console.log('bundle error:')
        console.warn(txBundle.error.message)
      } else {
        console.log("bundle submitted");
        return
      }

      console.log(`Try: ${i} -- block: ${nextBlock}`)
      i++
    } catch (err) {
      console.log('Request error')
      console.error(err)
      process.exit(1)
    }
  })
}

// Let's go!
main()

