require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const randomUser agent = require('random-useragent');
const axios = require('axios');
const prompt = require('prompt-sync')({ sigint: true });
const chalk = require('chalk');

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
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
    const bannerText = '19Seniman from Insider - FREE PALESTINE';
    const coloredBanner = bannerText.split('').map((char, index) => {
      return index % 2 === 0 ? chalk.red(char) : chalk.white(char);
    }).join('');
    console.log(coloredBanner);
    console.log('-------------------------------------------------');
    console.log(`${colors.reset}\n`);
  },
};

const networkConfig = {
  name: 'Pharos Testnet',
  chainId: 688688,
  rpcUrl: 'https://testnet.dplabs-internal.com',
  currencySymbol: 'PHRS',
};

const tokens = {
  USDC: '0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37',
  WPHRS: '0x76aaada469d23216be5f7c596fa25f282ff9b364',
  USDT: '0xed59de2d7ad9c043442e381231ee3646fc3c2939',
  POSITION_MANAGER: '0xF8a1D4FF0f9b9Af7CE58E1fc1833688F3BFd6115',
};

const poolAddresses = {
  USDC_WPHRS: '0x0373a059321219745aee4fad8a942cf088be3d0e',
  USDT_WPHRS: '0x70118b6eec45329e0534d849bc3e588bb6752527',
};

const contractAddress = '0x1a4de519154ae51200b0ad7c90f7fac75547888a';

const tokenDecimals = {
  WPHRS: 18,
  USDC: 6,
  USDT: 6,
};

const contractAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'collectionAndSelfcalls', type: 'uint256' },
      { internalType: 'bytes[]', name: 'data', type: 'bytes[]' },
    ],
    name: 'multicall',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function decimals() view returns (uint8)',
  'function deposit() public payable',
  'function withdraw(uint256 wad) public',
];

const positionManagerAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'token0', type: 'address' },
          { internalType: 'address', name: 'token1', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'int24', name: 'tickLower', type: 'int24' },
          { internalType: 'int24', name: 'tickUpper', type: 'int24' },
          { internalType: 'uint256', name: 'amount0Desired', type: 'uint256' },
          { internalType: 'uint256', name: 'amount1Desired', type: 'uint256' },
          { internalType: 'uint256', name: 'amount0Min', type: 'uint256' },
          { internalType: 'uint256', name: 'amount1Min', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        internalType: 'struct INonfungiblePositionManager.MintParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'mint',
    outputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint128', name: 'liquidity', type: 'uint128' },
      { internalType: 'uint256', name: 'amount0', type: 'uint256' },
      { internalType: 'uint256', name: 'amount1', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
];

const pairOptions = [
  { id: 1, from: 'WPHRS', to: 'USDC', amount: 0.0001 },
  { id: 2, from: 'WPHRS', to: 'USDT', amount: 0.0001 },
  { id: 3, from: 'USDC', to: 'WPHRS', amount: 0.0001 },
  { id: 4, from: 'USDT', to: 'WPHRS', amount: 0.0001 },
  { id: 5, from: 'USDC', to: 'USDT', amount: 0.0001 },
  { id: 6, from: 'USDT', to: 'USDC', amount: 0.0001 },
];

const lpOptions = [
  { id: 1, token0: 'WPHRS', token1: 'USDC', amount0: 0.0001, amount1: 0.0001, fee: 3000 },
  { id: 2, token0: 'WPHRS', token1: 'USDT', amount0: 0.0001, amount1: 0.0001, fee: 3000 },
];

const loadProxies = () => {
  try {
    const proxies = fs.readFileSync('proxies.txt', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    return proxies;
  } catch (error) {
    logger.warn('No proxies.txt found or failed to load, switching to direct mode');
    return [];
  }
};

const getRandomProxy = (proxies) => {
  return proxies[Math.floor(Math.random() * proxies.length)];
};

const setupProvider = (proxy = null) => {
  if (proxy) {
    logger.info(`Using proxy: ${proxy}`);
    const agent = new HttpsProxyAgent(proxy);
    return new ethers.JsonRpcProvider(networkConfig.rpcUrl, {
      chainId: networkConfig.chainId,
      name: networkConfig.name,
    }, {
      fetchOptions: { agent },
      headers: { 'User -Agent': randomUser agent.getRandom() },
    });
  } else {
    logger.info('Using direct mode (no proxy)');
    return new ethers.JsonRpcProvider(networkConfig.rpcUrl, {
      chainId: networkConfig.chainId,
      name: networkConfig.name,
    });
  }
};

const waitForTransactionWithRetry = async (provider, txHash, maxRetries = 5, baseDelayMs = 1000) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
      logger.warn(`Transaction receipt not found for ${txHash}, retrying (${retries + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, retries)));
      retries++;
    } catch (error) {
      logger.error(`Error fetching transaction receipt for ${txHash}: ${error.message}`);
      if (error.code === -32008) {
        logger.warn(`RPC error -32008, retrying (${retries + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, retries)));
        retries++;
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Failed to get transaction receipt for ${txHash} after ${maxRetries} retries`);
};

const checkBalanceAndApproval = async (wallet, tokenAddress, amount, decimals, spender) => {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    const required = ethers.parseUnits(amount.toString(), decimals);

    if (balance < required) {
      logger.warn(
        `Skipping: Insufficient ${Object.keys(tokenDecimals).find(
          key => tokenDecimals[key] === decimals
        )} balance: ${ethers.formatUnits(balance, decimals)} < ${amount}`
      );
      return false;
    }

    const allowance = await tokenContract.allowance(wallet.address, spender);
    if (allowance < required) {
      logger.step(`Approving ${amount} tokens for ${spender}...`);
      const estimatedGas = await tokenContract.approve.estimateGas(spender, ethers.MaxUint256);
      const feeData = await wallet.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
      const approveTx = await tokenContract.approve(spender, ethers.MaxUint256, {
        gasLimit: Math.ceil(Number(estimatedGas) * 1.2),
        gasPrice,
        maxFeePerGas: feeData.maxFeePerGas || undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
      });
      const receipt = await waitForTransactionWithRetry(wallet.provider, approveTx.hash);
      logger.success('Approval completed');
    }

    return true;
  } catch (error) {
    logger.error(`Balance/approval check failed: ${error.message}`);
    return false;
  }
};

const getUser Info = async (wallet, proxy = null, jwt) => {
  try {
    logger.user(`Fetching user info for wallet: ${wallet.address}`);
    const profileUrl = `https://api.pharosnetwork.xyz/user/profile?address=${wallet.address}`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: `Bearer ${jwt}`,
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User -Agent": randomUser agent.getRandom(),
    };

    const axiosConfig = {
      method: 'get',
      url: profileUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    };

    logger.loading('Fetching user profile...');
    const response = await axios(axiosConfig);
    const data = response.data;

    if (data.code !== 0 || !data.data.user_info) {
      logger.error(`Failed to fetch user info: ${data.msg || 'Unknown error'}`);
      return;
    }

    const userInfo = data.data.user_info;
    logger.info(`User  ID: ${userInfo.ID}`);
    logger.info(`Task Points: ${userInfo.TaskPoints}`);
    logger.info(`Total Points: ${userInfo.TotalPoints}`);
  } catch (error) {
    logger.error(`Failed to fetch user info: ${error.message}`);
  }
};

const verifyTask = async (wallet, proxy, jwt, txHash) => {
  try {
    logger.step(`Verifying task ID 103 for transaction: ${txHash}`);
    const verifyUrl = `https://api.pharosnetwork.xyz/task/verify?address=${wallet.address}&task_id=103&tx_hash=${txHash}`;
    
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: `Bearer ${jwt}`,
      priority: "u=1, i",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User -Agent": randomUser agent.getRandom(),
    };

    const axiosConfig = {
      method: 'post',
      url: verifyUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    };

    logger.loading('Sending task verification request...');
    const response = await axios(axiosConfig);
    const data = response.data;

    if (data.code === 0 && data.data.verified) {
      logger.success(`Task ID 103 verified successfully for ${txHash}`);
      return true;
    } else {
      logger.warn(`Task verification failed: ${data.msg || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logger.error(`Task verification failed for ${txHash}: ${error.message}`);
    return false;
  }
};

const getMulticallData = (pair, amount, walletAddress) => {
  try {
    const decimals = tokenDecimals[pair.from];
    const scaledAmount = ethers.parseUnits(amount.toString(), decimals);

    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
      [
        tokens[pair.from],
        tokens[pair.to],
        500,
        walletAddress,
        scaledAmount,
        0,
        0,
      ]
    );

    return [ethers.concat(['0x04e45aaf', data])];
  } catch (error) {
    logger.error(`Failed to generate multicall data: ${error.message}`);
    return [];
  }
};

const performSwap = async (wallet, provider, index, jwt, proxy) => {
  try {
    const pair = pairOptions[Math.floor(Math.random() * pairOptions.length)];
    const amount = pair.amount;
    logger.step(
      `Preparing swap ${index + 1}: ${pair.from} -> ${pair.to} (${amount} ${pair.from})`
    );

    const decimals = tokenDecimals[pair.from];
    const tokenContract = new ethers.Contract(tokens[pair.from], erc20Abi, provider);
    const balance = await tokenContract.balanceOf(wallet.address);
    const required = ethers.parseUnits(amount.toString(), decimals);

    if (balance < required) {
      logger.warn(
        `Skipping swap ${index + 1}: Insufficient ${pair.from} balance: ${ethers.formatUnits(
          balance,
          decimals
        )} < ${amount}`
      );
      return;
    }

    if (!(await checkBalanceAndApproval(wallet, tokens[pair.from], amount, decimals, contractAddress))) {
      return;
    }

    const contract = new ethers.Contract(contractAddress, contractAbi, wallet);
    const multicallData = getMulticallData(pair, amount, wallet.address);

    if (!multicallData || multicallData.length === 0 || multicallData.some(data => !data || data === '0x')) {
      logger.error(`Invalid or empty multicall data for ${pair.from} -> ${pair.to}`);
      return;
    }

    const deadline = Math.floor(Date.now() / 1000) + 300;
    let estimatedGas;
    try {
      estimatedGas = await contract.multicall.estimateGas(deadline, multicallData, {
        from: wallet.address,
      });
    } catch (error) {
      logger.error(`Gas estimation failed for swap ${index + 1}: ${error.message}`);
      return;
    }

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
    const tx = await contract.multicall(deadline, multicallData, {
      gasLimit: Math.ceil(Number(estimatedGas) * 1.2),
      gasPrice,
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
    });

    logger.loading(`Swap transaction ${index + 1} sent, waiting for confirmation...`);
    const receipt = await waitForTransactionWithRetry(provider, tx.hash);
    logger.success(`Swap ${index + 1} completed: ${receipt.hash}`);
    logger.step(`Explorer: https://testnet.pharosscan.xyz/tx/${receipt.hash}`);

    await verifyTask(wallet, proxy, jwt, receipt.hash);
  } catch (error) {
    logger.error(`Swap ${index + 1} failed: ${error.message}`);
    if (error
