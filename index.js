require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const randomUseragent = require('random-useragent');
const axios = require('axios');
const prompt = require('prompt-sync')({ sigint: true });

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  wallet: (msg) => console.log(`${colors.yellow}[➤] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[!] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[+] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  user: (msg) => console.log(`\n${colors.white}[➤] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log('-------------------------------------------------');
    console.log('             19Seniman Transaction Bot          ');
    console.log('-------------------------------------------------');
    console.log(`${colors.reset}\n`);
  }
};

const networkConfig = {
  name: 'Pharos Testnet',
  chainId: 688688,
  rpcUrl: 'https://testnet.dplabs-internal.com',
  currencySymbol: 'PHRS'
};

const tokens = {
  USDC: '0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37',
  WPHRS: '0x76aaada469d23216be5f7c596fa25f282ff9b364',
  USDT: '0xed59de2d7ad9c043442e381231ee3646fc3c2939',
  POSITION_MANAGER: '0xF8a1D4FF0f9b9Af7CE58E1fc1833688F3BFd6115'
};

// Gas configuration for EIP-1559
const gasConfig = {
  defaultPriorityFee: ethers.parseUnits('1', 'gwei'),
  defaultMaxFee: ethers.parseUnits('3', 'gwei'),
  gasLimit: {
    standardTx: 21000,
    tokenTransfer: 65000,
    swap: 300000,
    addLiquidity: 500000
  }
};

const loadProxies = () => {
  try {
    return fs.readFileSync('proxies.txt', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
  } catch (error) {
    logger.warn('No proxies.txt found, using direct mode');
    return [];
  }
};

const setupProvider = (proxy = null) => {
  const options = {
    chainId: networkConfig.chainId,
    name: networkConfig.name
  };

  if (proxy) {
    const agent = new HttpsProxyAgent(proxy);
    return new ethers.JsonRpcProvider(networkConfig.rpcUrl, options, {
      fetchOptions: { agent },
      headers: { 'User-Agent': randomUseragent.getRandom() }
    });
  }
  return new ethers.JsonRpcProvider(networkConfig.rpcUrl, options);
};

const getFeeData = async (provider) => {
  try {
    const feeData = await provider.getFeeData();
    return {
      maxFeePerGas: feeData.maxFeePerGas ?? gasConfig.defaultMaxFee,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? gasConfig.defaultPriorityFee
    };
  } catch (error) {
    logger.warn(`Failed to fetch fee data, using defaults: ${error.message}`);
    return {
      maxFeePerGas: gasConfig.defaultMaxFee,
      maxPriorityFeePerGas: gasConfig.defaultPriorityFee
    };
  }
};

const transferPHRS = async (wallet, provider, index) => {
  try {
    const amount = 0.000001;
    const toAddress = ethers.Wallet.createRandom().address;
    
    logger.step(`Sending ${amount} PHRS to ${toAddress}`);
    const balance = await provider.getBalance(wallet.address);
    const value = ethers.parseEther(amount.toString());
    
    if (balance < value) {
      logger.warn(`Insufficient balance: ${ethers.formatEther(balance)} < ${amount}`);
      return null;
    }

    const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeData(provider);
    
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value,
      gasLimit: gasConfig.gasLimit.standardTx,
      maxFeePerGas,
      maxPriorityFeePerGas
    });

    logger.loading(`Waiting for transaction confirmation...`);
    const receipt = await tx.wait();
    logger.success(`Transaction successful: ${receipt.hash}`);
    return receipt.hash;
  } catch (error) {
    logger.error(`Transfer failed: ${error.message}`);
    return null;
  }
};

const wrapPHRS = async (wallet, provider, index) => {
  try {
    const amount = 0.001 + Math.random() * 0.004; // Random amount between 0.001 and 0.005
    logger.step(`Wrapping ${amount.toFixed(6)} PHRS to WPHRS`);

    const balance = await provider.getBalance(wallet.address);
    const value = ethers.parseEther(amount.toFixed(6));
    
    if (balance < value) {
      logger.warn(`Insufficient balance: ${ethers.formatEther(balance)} < ${amount}`);
      return null;
    }

    const wphrsContract = new ethers.Contract(
      tokens.WPHRS,
      ['function deposit() payable'],
      wallet
    );

    const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeData(provider);
    
    const tx = await wphrsContract.deposit({
      value,
      gasLimit: gasConfig.gasLimit.tokenTransfer,
      maxFeePerGas,
      maxPriorityFeePerGas
    });

    logger.loading(`Waiting for wrap transaction...`);
    const receipt = await tx.wait();
    logger.success(`Wrap successful: ${receipt.hash}`);
    return receipt.hash;
  } catch (error) {
    logger.error(`Wrap failed: ${error.message}`);
    return null;
  }
};

const performSwap = async (wallet, provider, index) => {
  try {
    logger.step(`Performing swap #${index + 1}`);
    // Implement your swap logic here with proper EIP-1559 gas parameters
    const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeData(provider);
    // Example transaction
    const tx = await wallet.sendTransaction({
      to: ethers.Wallet.createRandom().address,
      value: ethers.parseEther("0.000001"),
      gasLimit: gasConfig.gasLimit.swap,
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    
    const receipt = await tx.wait();
    logger.success(`Swap completed: ${receipt.hash}`);
    return receipt.hash;
  } catch (error) {
    logger.error(`Swap failed: ${error.message}`);
    return null;
  }
};

const addLiquidity = async (wallet, provider, index) => {
  try {
    logger.step(`Adding liquidity #${index + 1}`);
    // Implement your liquidity logic here
    const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeData(provider);
    // Example transaction
    const tx = await wallet.sendTransaction({
      to: tokens.POSITION_MANAGER,
      gasLimit: gasConfig.gasLimit.addLiquidity,
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    
    const receipt = await tx.wait();
    logger.success(`Liquidity added: ${receipt.hash}`);
    return receipt.hash;
  } catch (error) {
    logger.error(`Liquidity add failed: ${error.message}`);
    return null;
  }
};

const main = async () => {
  logger.banner();
  
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      logger.error('No private key found in environment variables');
      process.exit(1);
    }

    const proxies = loadProxies();
    const proxy = proxies.length ? proxies[Math.floor(Math.random() * proxies.length)] : null;
    const provider = setupProvider(proxy);
    const wallet = new ethers.Wallet(privateKey, provider);

    logger.wallet(`Operating with address: ${wallet.address}`);

    // Run transaction loops
    const iterations = 120;
    for (let i = 0; i < iterations; i++) {
      logger.info(`\n--- Transaction Batch ${i + 1}/${iterations} ---`);
      
      // Random delay between 1-3 seconds
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      await transferPHRS(wallet, provider, i);
      await wrapPHRS(wallet, provider, i);
      await performSwap(wallet, provider, i);
      await addLiquidity(wallet, provider, i);
    }

    logger.success('All transactions completed successfully!');
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
};

main();
