# Pharos Testnet layer 1 Auto Bot

An automated bot for interacting with the Pharos Testnet, performing swaps, transfers, faucet claims, and daily check-ins to potentially qualify for airdrops.


## Prerequisites 📋

- Node.js (v18 or higher)
- npm or yarn
- Pharos Testnet wallet with private keys
- (Optional) Proxy list in `proxies.txt`


Register pharos Testnet : https://testnet.pharosnetwork.xyz/experience?inviteCode=XyMMxO15RzVwndcj 

🔲Connect Wallet 

🔲Tautkan X & Discod

🔲 Claim Faucet : Faucet https://testnet.pharosnetwork.xyz/

🔲 Check in 

🔲 Swap 10x

🔲 Add Liquidity 10x

🔲 Send Token Pharos other walllet ( your friends ) 10x

✅Done lakukan setiap hari

## Installation ⚙️

1. Clone the repository:
   ```bash
   git clone https://github.com/19seniman/pharos-layer1-.git
   cd pharos-layer1
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. nano .env 
   ```
   PRIVATE_KEY_1=your_first_private_key_here
   PRIVATE_KEY_2=your_second_private_key_here
   ```

4. (Optional) Add proxies to `proxies.txt` (one per line):
   ```
   http://user:pass@ip:port
   socks5://user:pass@ip:port
   ```

## Configuration ⚙️

The bot comes with default settings for the Pharos Testnet, but you can modify:

- Network RPC URL in `networkConfig`
- Contract addresses in `tokens` object
- Swap amounts in `performSwap` function
- Transfer amounts in `transferPHRS` function

## Usage 🚀

Run the bot:
```bash
node index.js
```

The bot will:
1. Display a banner with project info
2. Load proxies (if available)
3. Process each wallet sequentially:
   - Claim faucet (if available)
   - Perform daily check-in
   - Execute 10 PHRS transfers
   - Execute 10 token swaps
4. Repeat every 30 minutes


## Disclaimer ⚠️

This software is provided "as is" without warranties. Use at your own risk. The developers are not responsible for any losses or issues caused by using this bot.

## License 📄

MIT License - See LICENSE file for details
