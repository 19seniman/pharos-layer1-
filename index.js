const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
require('dotenv').config();

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m"
};

const loggerTheme = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgGray: "\x1b[100m",
};

const fancyBox = (title, subtitle) => {
  console.log(`${loggerTheme.cyan}${loggerTheme.bold}`);
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  ${title.padEnd(42)}  ║`);
  if (subtitle) {
    console.log(`║  ${subtitle.padEnd(42)}  ║`);
  }
  console.log('╚══════════════════════════════════════════════╝');
  console.log(loggerTheme.reset);
};

const NETWORK_CONFIG = {
  rpc: 'https://testnet.dplabs-internal.com',
  chainId: 688688,
  symbol: 'PHRS',
  explorer: 'https://pharos-testnet.socialscan.io/'
};

const CONTRACTS = {
  LENDING_POOL: '0xa8e550710bf113db6a1b38472118b8d6d5176d12',
  FAUCET: '0x2e9d89d372837f71cb529e5ba85bfbc1785c69cd',
  SUPPLY_CONTRACT: '0xad3b4e20412a097f87cd8e8d84fbbe17ac7c89e9',
  TOKENS: {
    NVIDIA: '0x3299cc551b2a39926bf14144e65630e533df6944',
    USDT: '0x0b00fb1f513e02399667fba50772b21f34c1b5d9',
    USDC: '0x48249feeb47a8453023f702f15cf00206eebdf08',
    GOLD: '0x77f532df5f46ddff1c97cdae3115271a523fa0f4',
    TSLA: '0xcda3df4aab8a571688fe493eb1bdc1ad210c09e4',
    BTC: '0xa4a967fc7cf0e9815bf5c2700a055813628b65be'
  }
};

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

const FAUCET_ABI = [
  "function mint(address _asset, address _account, uint256 _amount) external"
];

const LENDING_POOL_ABI = [
  "function depositETH(address lendingPool, address onBehalfOf, uint16 referralCode) external payable",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
  "function withdraw(address asset, uint256 amount, address to) external"
];

class PharosBot {
  constructor() {
    this.providers = [];
    this.wallets = [];
    this.proxies = [];
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async initialize() {
    logger.banner();
    await this.loadProxies();
    await this.loadWallets();
    logger.success(`Initialized with ${this.wallets.length} wallets and ${this.proxies.length} proxies`);
  }

  async loadProxies() {
    try {
      if (fs.existsSync('proxies.txt')) {
        const proxyData = fs.readFileSync('proxies.txt', 'utf8');
        this.proxies = proxyData.split('\n').filter(line => line.trim());
        logger.info(`Loaded ${this.proxies.length} proxies`);
      } else {
        logger.warn('proxies.txt not found, running without proxies');
      }
    } catch (error) {
      logger.error(`Error loading proxies: ${error.message}`);
    }
  }

  createProxyAgent(proxyUrl) {
    try {
      if (proxyUrl.startsWith('http://')) {
        return new HttpProxyAgent(proxyUrl);
      } else if (proxyUrl.startsWith('https://')) {
        return new HttpsProxyAgent(proxyUrl);
      } else if (proxyUrl.startsWith('socks://') || proxyUrl.startsWith('socks5://')) {
        return new SocksProxyAgent(proxyUrl);
      }
      return null;
    } catch (error) {
      logger.error(`Error creating proxy agent: ${error.message}`);
      return null;
    }
  }

  async loadWallets() {
    const privateKeys = [];
    let i = 1;
    
    while (process.env[`PRIVATE_KEY_${i}`]) {
      privateKeys.push(process.env[`PRIVATE_KEY_${i}`]);
      i++;
    }

    if (privateKeys.length === 0) {
      logger.error('No private keys found in .env file');
      process.exit(1);
    }

    for (let i = 0; i < privateKeys.length; i++) {
      const proxyUrl = this.proxies[i % this.proxies.length];
      let provider;

      if (proxyUrl) {
        const agent = this.createProxyAgent(proxyUrl);
        if (agent) {
          provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpc, {
            chainId: NETWORK_CONFIG.chainId,
            name: 'pharos-testnet'
          }, {
            staticNetwork: true,
            fetchOptions: {
              agent: agent
            }
          });
        } else {
          provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpc);
        }
      } else {
        provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpc);
      }

      const wallet = new ethers.Wallet(privateKeys[i], provider);
      this.wallets.push(wallet);
      this.providers.push(provider);
      
      logger.info(`Wallet ${i + 1}: ${wallet.address} ${proxyUrl ? `(Proxy: ${proxyUrl.substring(0, 20)}...)` : '(No Proxy)'}`);
    }
  }

  async getUserInput(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async showMenu() {
    console.log(`\n${colors.cyan}${colors.bold}--- OPENFI TESTNET BOT MENU ---${colors.reset}`);
    console.log(`${colors.white}1. Supply PHRS${colors.reset}`);
    console.log(`${colors.white}2. Mint Faucet Tokens${colors.reset}`);
    console.log(`${colors.white}3. Supply ERC20 Tokens${colors.reset}`);
    console.log(`${colors.white}4. Borrow Tokens${colors.reset}`);
    console.log(`${colors.white}5. Withdraw Tokens${colors.reset}`);
    console.log(`${colors.white}6. Exit${colors.reset}`);
    console.log(`${colors.cyan}------------------------------${colors.reset}\n`);

    const choice = await this.getUserInput('Select an option (1-6): ');
    return choice;
  }

  async supplyPHRS() {
    logger.step('Starting PHRS Supply Process');
    
    const amount = await this.getUserInput('Enter amount of PHRS to supply: ');
    const transactions = await this.getUserInput('Enter number of transactions per wallet: ');
    
    const amountWei = ethers.parseEther(amount);
    const txCount = parseInt(transactions);

    for (let i = 0; i < this.wallets.length; i++) {
      const wallet = this.wallets[i];
      logger.loading(`Processing wallet ${i + 1}: ${wallet.address}`);

      try {
        const balance = await wallet.provider.getBalance(wallet.address);
        logger.info(`Wallet balance: ${ethers.formatEther(balance)} PHRS`);

        if (balance < amountWei * BigInt(txCount)) {
          logger.warn(`Insufficient balance for wallet ${i + 1}`);
          continue;
        }

        const lendingContract = new ethers.Contract(
          CONTRACTS.LENDING_POOL,
          LENDING_POOL_ABI,
          wallet
        );

        for (let j = 0; j < txCount; j++) {
          try {
            logger.loading(`Transaction ${j + 1}/${txCount} for wallet ${i + 1}`);
            
            const tx = await lendingContract.depositETH(
              '0x0000000000000000000000000000000000000000',
              wallet.address,
              0,
              { value: amountWei }
            );

            logger.success(`TX Hash: ${tx.hash}`);
            await tx.wait();
            logger.success(`Transaction ${j + 1} confirmed`);

            if (j < txCount - 1) {
              await this.delay(2000);
            }
          } catch (error) {
            logger.error(`Transaction ${j + 1} failed: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Error processing wallet ${i + 1}: ${error.message}`);
      }

      if (i < this.wallets.length - 1) {
        await this.delay(3000);
      }
    }
  }

  async mintFaucetTokens() {
    logger.step('Starting Faucet Token Minting');
    
    console.log('\nAvailable tokens for minting:');
    const tokenNames = Object.keys(CONTRACTS.TOKENS);
    tokenNames.forEach((token, index) => {
      console.log(`${index + 1}. ${token}`);
    });

    const tokenChoice = await this.getUserInput('Select token to mint (1-6): ');
    const tokenIndex = parseInt(tokenChoice) - 1;
    
    if (tokenIndex < 0 || tokenIndex >= tokenNames.length) {
      logger.error('Invalid token selection');
      return;
    }

    const selectedToken = tokenNames[tokenIndex];
    const tokenAddress = CONTRACTS.TOKENS[selectedToken];
    
    const amount = await this.getUserInput(`Enter amount of ${selectedToken} to mint: `);
    const transactions = await this.getUserInput('Enter number of transactions per wallet: ');
    
    const decimals = selectedToken === 'USDT' || selectedToken === 'USDC' || selectedToken === 'BTC' ? 6 : 18;
    const amountWei = ethers.parseUnits(amount, decimals);
    const txCount = parseInt(transactions);

    for (let i = 0; i < this.wallets.length; i++) {
      const wallet = this.wallets[i];
      logger.loading(`Processing wallet ${i + 1}: ${wallet.address}`);

      try {
        const faucetContract = new ethers.Contract(
          CONTRACTS.FAUCET,
          FAUCET_ABI,
          wallet
        );

        for (let j = 0; j < txCount; j++) {
          try {
            logger.loading(`Minting ${selectedToken} - Transaction ${j + 1}/${txCount} for wallet ${i + 1}`);
            
            const tx = await faucetContract.mint(
              tokenAddress,
              wallet.address,
              amountWei
            );

            logger.success(`TX Hash: ${tx.hash}`);
            await tx.wait();
            logger.success(`Mint transaction ${j + 1} confirmed`);

            if (j < txCount - 1) {
              await this.delay(2000);
            }
          } catch (error) {
            logger.error(`Mint transaction ${j + 1} failed: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Error processing wallet ${i + 1}: ${error.message}`);
      }

      if (i < this.wallets.length - 1) {
        await this.delay(3000);
      }
    }
  }

  async supplyERC20Tokens() {
    logger.step('Starting ERC20 Token Supply');
    
    console.log('\nAvailable tokens for supply:');
    const tokenNames = Object.keys(CONTRACTS.TOKENS);
    tokenNames.forEach((token, index) => {
      console.log(`${index + 1}. ${token}`);
    });

    const tokenChoice = await this.getUserInput('Select token to supply (1-6): ');
    const tokenIndex = parseInt(tokenChoice) - 1;
    
    if (tokenIndex < 0 || tokenIndex >= tokenNames.length) {
      logger.error('Invalid token selection');
      return;
    }

    const selectedToken = tokenNames[tokenIndex];
    const tokenAddress = CONTRACTS.TOKENS[selectedToken];
    
    const amount = await this.getUserInput(`Enter amount of ${selectedToken} to supply: `);
    const transactions = await this.getUserInput('Enter number of transactions per wallet: ');
    
    const decimals = selectedToken === 'USDT' || selectedToken === 'USDC' || selectedToken === 'BTC' ? 6 : 18;
    const amountWei = ethers.parseUnits(amount, decimals);
    const txCount = parseInt(transactions);

    for (let i = 0; i < this.wallets.length; i++) {
      const wallet = this.wallets[i];
      logger.loading(`Processing wallet ${i + 1}: ${wallet.address}`);

      try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

        for (let j = 0; j < txCount; j++) {
          try {
            logger.loading(`Approving ${selectedToken} - Transaction ${j + 1}/${txCount} for wallet ${i + 1}`);
            
            const approveTx = await tokenContract.approve(
              CONTRACTS.SUPPLY_CONTRACT,
              ethers.MaxUint256
            );

            logger.info(`Approve TX Hash: ${approveTx.hash}`);
            await approveTx.wait();

            logger.loading(`Supplying ${selectedToken} - Transaction ${j + 1}/${txCount} for wallet ${i + 1}`);
            
            const iface = new ethers.Interface([
              "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"
            ]);
            
            const supplyData = iface.encodeFunctionData("supply", [
              tokenAddress,
              amountWei,
              wallet.address,
              0
            ]);

            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const encodedParams = abiCoder.encode(
              ['address', 'uint256', 'address', 'uint16'],
              [tokenAddress, amountWei, wallet.address, 0]
            );
            
            const finalData = '0x617ba037' + encodedParams.slice(2);

            const supplyTx = await wallet.sendTransaction({
              to: CONTRACTS.SUPPLY_CONTRACT,
              data: finalData,
              gasLimit: 500000
            });

            logger.success(`Supply TX Hash: ${supplyTx.hash}`);
            await supplyTx.wait();
            logger.success(`Supply transaction ${j + 1} confirmed`);

            if (j < txCount - 1) {
              await this.delay(2000);
            }
          } catch (error) {
            logger.error(`Supply transaction ${j + 1} failed: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Error processing wallet ${i + 1}: ${error.message}`);
      }

      if (i < this.wallets.length - 1) {
        await this.delay(3000);
      }
    }
  }

  async borrowTokens() {
    logger.step('Starting Token Borrow Process');
    
    console.log('\nAvailable tokens for borrowing:');
    const tokenNames = Object.keys(CONTRACTS.TOKENS);
    tokenNames.forEach((token, index) => {
      console.log(`${index + 1}. ${token}`);
    });

    const tokenChoice = await this.getUserInput('Select token to borrow (1-6): ');
    const tokenIndex = parseInt(tokenChoice) - 1;
    
    if (tokenIndex < 0 || tokenIndex >= tokenNames.length) {
      logger.error('Invalid token selection');
      return;
    }

    const selectedToken = tokenNames[tokenIndex];
    const tokenAddress = CONTRACTS.TOKENS[selectedToken];
    
    const amount = await this.getUserInput(`Enter amount of ${selectedToken} to borrow: `);
    const transactions = await this.getUserInput('Enter number of transactions per wallet: ');
    
    const decimals = selectedToken === 'USDT' || selectedToken === 'USDC' || selectedToken === 'BTC' ? 6 : 18;
    const amountWei = ethers.parseUnits(amount, decimals);
    const txCount = parseInt(transactions);

    for (let i = 0; i < this.wallets.length; i++) {
      const wallet = this.wallets[i];
      logger.loading(`Processing wallet ${i + 1}: ${wallet.address}`);

      try {
        const lendingContract = new ethers.Contract(
          CONTRACTS.SUPPLY_CONTRACT,
          LENDING_POOL_ABI,
          wallet
        );

        for (let j = 0; j < txCount; j++) {
          try {
            logger.loading(`Borrowing ${selectedToken} - Transaction ${j + 1}/${txCount} for wallet ${i + 1}`);
            
            const iface = new ethers.Interface([
              "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)"
            ]);
            
            const borrowData = iface.encodeFunctionData("borrow", [
              tokenAddress,
              amountWei,
              2, 
              0, 
              wallet.address
            ]);

            const tx = await wallet.sendTransaction({
              to: CONTRACTS.SUPPLY_CONTRACT,
              data: borrowData,
              gasLimit: 465383 
            });

            logger.success(`Borrow TX Hash: ${tx.hash}`);
            await tx.wait();
            logger.success(`Borrow transaction ${j + 1} confirmed`);

            if (j < txCount - 1) {
              await this.delay(2000);
            }
          } catch (error) {
            logger.error(`Borrow transaction ${j + 1} failed: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Error processing wallet ${i + 1}: ${error.message}`);
      }

      if (i < this.wallets.length - 1) {
        await this.delay(3000);
      }
    }
  }

  async withdrawTokens() {
    logger.step('Starting Token Withdraw Process');
    
    console.log('\nAvailable tokens for withdrawal:');
    const tokenNames = Object.keys(CONTRACTS.TOKENS);
    tokenNames.forEach((token, index) => {
      console.log(`${index + 1}. ${token}`);
    });

    const tokenChoice = await this.getUserInput('Select token to withdraw (1-6): ');
    const tokenIndex = parseInt(tokenChoice) - 1;
    
    if (tokenIndex < 0 || tokenIndex >= tokenNames.length) {
      logger.error('Invalid token selection');
      return;
    }

    const selectedToken = tokenNames[tokenIndex];
    const tokenAddress = CONTRACTS.TOKENS[selectedToken];
    
    const amount = await this.getUserInput(`Enter amount of ${selectedToken} to withdraw: `);
    const transactions = await this.getUserInput('Enter number of transactions per wallet: ');
    
    const decimals = selectedToken === 'USDT' || selectedToken === 'USDC' || selectedToken === 'BTC' ? 6 : 18;
    const amountWei = ethers.parseUnits(amount, decimals);
    const txCount = parseInt(transactions);

    for (let i = 0; i < this.wallets.length; i++) {
      const wallet = this.wallets[i];
      logger.loading(`Processing wallet ${i + 1}: ${wallet.address}`);

      try {
        const lendingContract = new ethers.Contract(
          CONTRACTS.SUPPLY_CONTRACT,
          LENDING_POOL_ABI,
          wallet
        );

        for (let j = 0; j < txCount; j++) {
          try {
            logger.loading(`Withdrawing ${selectedToken} - Transaction ${j + 1}/${txCount} for wallet ${i + 1}`);
            
            const iface = new ethers.Interface([
              "function withdraw(address asset, uint256 amount, address to)"
            ]);
            
            const withdrawData = iface.encodeFunctionData("withdraw", [
              tokenAddress,
              amountWei,
              wallet.address
            ]);

            const tx = await wallet.sendTransaction({
              to: CONTRACTS.SUPPLY_CONTRACT,
              data: withdrawData,
              gasLimit: 512475 
            });

            logger.success(`Withdraw TX Hash: ${tx.hash}`);
            await tx.wait();
            logger.success(`Withdraw transaction ${j + 1} confirmed`);

            if (j < txCount - 1) {
              await this.delay(2000);
            }
          } catch (error) {
            logger.error(`Withdraw transaction ${j + 1} failed: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Error processing wallet ${i + 1}: ${error.message}`);
      }

      if (i < this.wallets.length - 1) {
        await this.delay(3000);
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    try {
      await this.initialize();

      while (true) {
        const choice = await this.showMenu();

        switch (choice) {
          case '1':
            await this.supplyPHRS();
            break;
          case '2':
            await this.mintFaucetTokens();
            break;
          case '3':
            await this.supplyERC20Tokens();
            break;
          case '4':
            await this.borrowTokens();
            break;
          case '5':
            await this.withdrawTokens();
            break;
          case '6':
            logger.success('Exiting bot...');
            this.rl.close();
            process.exit(0);
            break;
          default:
            logger.error('Invalid choice. Please select 1-6.');
        }

        await this.getUserInput('\nPress Enter to continue...');
      }
    } catch (error) {
      logger.error(`Fatal error: ${error.message}`);
      this.rl.close();
      process.exit(1);
    }
  }
}

const bot = new PharosBot();
bot.run().catch(console.error);
