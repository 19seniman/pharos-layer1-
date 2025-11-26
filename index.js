require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');
const readline = require('readline');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { URL } = require('url');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gold: '\x1b[33;1m', 
    bold: '\x1b[1m'
};

function fancyBox(text1, text2) {
    const width = 60;
    const line = '─'.repeat(width);
    const pad = (str) => {
        const len = str.length;
        const p = Math.floor((width - len) / 2);
        return ' '.repeat(p) + str + ' '.repeat(width - len - p);
    };
    console.log(`${colors.cyan}┌${line}┐${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset}${pad(text1)}${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset}${pad(text2)}${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}└${line}┘${colors.reset}\n`);
}

const logger = {
    info: (msg) => console.log(`${colors.blue}[ ℹ INFO ] → ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}[ ⚠ WARNING ] → ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}[ ✖ ERROR ] → ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}[ ✔ DONE ] → ${msg}${colors.reset}`),
    loading: (msg) => console.log(`${colors.cyan}[ ⌛ LOADING ] → ${msg}${colors.reset}`),
    step: (msg) => console.log(`${colors.magenta}[ ➔ STEP ] → ${msg}${colors.reset}`),
    wallet: (msg) => console.log(`${colors.gold}[ 💰 WALLET ] → ${msg}${colors.reset}`),
    user: (msg) => console.log(`\n${colors.white}[➤] ${msg}${colors.reset}`),
    banner: () => fancyBox(' 🍉🍉 Free Palestine 🍉🍉', '— 19Seniman From Insider 🏴‍☠️ —'),
};

// --- Constants & Config ---
const PHAROS_RPC_URL = 'https://atlantic.dplabs-internal.com';
const CHAIN_ID = 688689;
const PHAROS_API_BASE = 'https://api.pharosnetwork.xyz';
const ASSETO_API_BASE = 'https://asseto.finance/api';

const CASHPLUS_ADDRESS = '0x56f4add11d723412d27a9e9433315401b351d6e3';
const USDT_ADDRESS_CONST = '0xe7e84b8b4f39c507499c40b4ac199b050e2882d5';

const FAROSWAP_REFERER = 'https://faroswap.xyz/';
const DODO_API = 'https://api.dodoex.io';
const DODO_ROUTE_ENDPOINT = `${DODO_API}/route-service/v2/widget/getdodoroute`;
const DODO_PRICE_ENDPOINT = `${DODO_API}/frontend-price-api/current/batch`;
const DODO_APIKEY = 'a37546505892e1a952';
const FARO_DODO_PROXY = '0x819829e5CF6e19F9fED92F6b4CC1edF45a2cC4A2';
const FAROSWAP_SLIPPAGE = 3.225;
const ROUTE_SOURCE = 'dodoV2AndMixWasm';

const FAROSWAP_LIQUIDITY_ROUTER_ADDRESS = '0xb93Cd1E38809607a00FF9CaB633db5CAA6130dD0';
const LIQUIDITY_TOKEN_A_OBJ = { symbol: 'WPHRS', address: '0x838800b758277CC111B2d48Ab01e5E164f8E9471', decimals: 18 };
const LIQUIDITY_TOKEN_B_OBJ = { symbol: 'USDT', address: '0xE7E84B8B4f39C507499c40B4ac199B050e2882d5', decimals: 6 };

const LIQUIDITY_AMOUNT_A_WEI = '0x640b5eece000';
const LIQUIDITY_AMOUNT_B_WEI = '0xd7c8';
const LIQUIDITY_AMOUNT_A_MIN_WEI = '0x638b505ee400';
const LIQUIDITY_AMOUNT_B_MIN_WEI = '0xd6b3';
const LIQUIDITY_FEE_UINT = 30n;

const FAROSWAP_LIQUIDITY_ROUTER_ABI = [
    "function addLiquidity(address tokenA, address tokenB, uint256 fee, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline)"
];

const EXPLORER_URL = 'https://atlantic.pharosscan.xyz';
const PHRS_TO_SEND = '0.009';

const TOKENS = {
    PHRS: { symbol: 'PHRS', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, isNative: true },
    WPHRS: { symbol: 'WPHRS', address: '0x838800b758277CC111B2d48Ab01e5E164f8E9471', decimals: 18, isNative: false },
    USDT: { symbol: 'USDT', address: '0xE7E84B8B4f39C507499c40B4ac199B050e2882d5', decimals: 6, isNative: false },
    USDC: { symbol: 'USDC', address: '0xE0BE08c77f415F577A1B3A9aD7a1Df1479564ec8', decimals: 6, isNative: false },
    WETH: { symbol: 'WETH', address: '0x7d211F77525ea39A0592794f793cC1036eEaccD5', decimals: 18, isNative: false },
    WBTC: { symbol: 'WBTC', address: '0x0c64F03EEa5c30946D5c55B4b532D08ad74638a4', decimals: 18, isNative: false },
};

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)"
];
const CASHPLUS_ABI = [
    "function subscribe(address uAddress, uint256 uAmount)",
    "function redemption(address uAddress, uint256 tokenAmount)"
];

const WALLETS_FILE = 'wallets.json';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function loadProxies() {
    try {
        const data = fs.readFileSync('proxies.txt', 'utf8');
        const proxies = data.split('\n').filter(p => p.trim() !== '');
        if (proxies.length === 0) {
            logger.warn('proxies.txt is empty. Running without proxies.');
            return [];
        }
        logger.success(`Loaded ${proxies.length} proxies.`);
        return proxies;
    } catch (err) {
        logger.warn('proxies.txt not found. Running without proxies.');
        return [];
    }
}

function getProxyAgent(proxies) {
    if (proxies.length === 0) {
        return null;
    }
    const proxyString = proxies[Math.floor(Math.random() * proxies.length)];
    return new HttpsProxyAgent(proxyString);
}

function staticUserAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
}

function loadAccounts() {
    const accounts = [];
    let i = 1;
    while (process.env[`PRIVATE_KEY_${i}`]) {
        accounts.push({
            index: i,
            pk: process.env[`PRIVATE_KEY_${i}`],
        });
        i++;
    }
    if (accounts.length === 0) {
        logger.error('No accounts found in .env file.');
        logger.error('Please format as PRIVATE_KEY_1=...');
        process.exit(1);
    }
    logger.success(`Loaded ${accounts.length} accounts from .env`);
    return accounts;
}

function createAxiosInstance(proxyAgent) {
    return axios.create({
        httpsAgent: proxyAgent,
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Priority': 'u=1, i',
            'Sec-Ch-Ua': '"Brave";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'Sec-Gpc': '1',
            'User-Agent': staticUserAgent(),
        }
    });
}

function askQuestion(query, rl) {
    return new Promise(resolve => rl.question(query, resolve));
}

function loadRandomWallets() {
    try {
        if (fs.existsSync(WALLETS_FILE)) {
            const data = fs.readFileSync(WALLETS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (err) {
        logger.error(`Error reading ${WALLETS_FILE}: ${err.message}`);
        return [];
    }
}

function saveRandomWallet(wallet) {
    const wallets = loadRandomWallets();
    wallets.push({
        address: wallet.address,
        privateKey: wallet.privateKey
    });
    try {
        fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
        logger.info(`Saved new random wallet: ${wallet.address}`);
    } catch (err) {
        logger.error(`Failed to save ${WALLETS_FILE}: ${err.message}`);
    }
}

function createPharosSiweMessage(address, chainId, domain, uri, nonce, timestamp) {
    return `${domain} wants you to sign in with your Ethereum account:
${address}

I accept the Pharos Terms of Service: ${domain}/privacy-policy/Pharos-PrivacyPolicy.pdf

URI: ${uri}

Version: 1

Chain ID: ${chainId}

Nonce: ${nonce}

Issued At: ${timestamp}`;
}

async function pharosLogin(wallet, axiosInstance) {
    logger.loading('Attempting Pharos login to get JWT...');
    axiosInstance.defaults.headers.common['Referer'] = 'https://testnet.pharosnetwork.xyz/';
    axiosInstance.defaults.headers.common['Authorization'] = 'Bearer null';
    axiosInstance.defaults.headers.post['Content-Type'] = 'application/json';

    try {
        const domain = 'testnet.pharosnetwork.xyz';
        const uri = 'https://testnet.pharosnetwork.xyz';
        const chainId = CHAIN_ID.toString();
        const timestamp = new Date().toISOString();
        const nonce = Math.floor(Math.random() * 10000000).toString();
        const message = createPharosSiweMessage(wallet.address, chainId, domain, uri, nonce, timestamp);

        logger.loading('Signing Pharos login message...');
        const signature = await wallet.signMessage(message);

        const loginBody = {
            address: wallet.address,
            signature: signature,
            wallet: "Rabby Wallet",
            nonce: nonce,
            chain_id: chainId,
            timestamp: timestamp,
            domain: domain
        };

        const res = await axiosInstance.post(`${PHAROS_API_BASE}/user/login`, loginBody);

        if (res.data.code === 0 && res.data.data.jwt) {
            logger.success('Successfully logged into Pharos and got JWT.');
            return res.data.data.jwt;
        } else {
            logger.error(`Pharos login failed: ${res.data.msg || 'Unknown error'}`);
            return null;
        }
    } catch (err) {
        logger.error(`Pharos login request failed: ${err.message}`);
        if (err.response) {
            logger.error(`Response Data: ${JSON.stringify(err.response.data)}`);
        }
        return null;
    }
}

async function pharosCheckInAndProfile(wallet, jwt, axiosInstance) {
    logger.wallet(`Address: ${wallet.address}`);
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
    axiosInstance.defaults.headers.common['Referer'] = 'https://testnet.pharosnetwork.xyz/';

    try {
        logger.loading('Performing daily check-in...');
        const checkinRes = await axiosInstance.post(`${PHAROS_API_BASE}/sign/in`, { address: wallet.address });
        if (checkinRes.data.code === 0) {
            logger.success('Daily check-in successful.');
        } else {
            logger.warn(`Check-in response: ${checkinRes.data.msg || 'Unknown error'}`);
        }
    } catch (err) {
        logger.error(`Check-in failed: ${err.message}`);
    }

    await delay(1000);

    try {
        logger.loading('Fetching user profile...');
        const profileRes = await axiosInstance.get(`${PHAROS_API_BASE}/user/profile?address=${wallet.address}`);
        if (profileRes.data.code === 0 && profileRes.data.data.user_info) {
            const info = profileRes.data.data.user_info;
            logger.success('Fetched profile:');
            console.log(`   > ${colors.cyan}Address:${colors.reset} ${info.Address}`);
            console.log(`   > ${colors.cyan}Total Points:${colors.reset} ${info.TotalPoints}`);
            console.log(`   > ${colors.cyan}Invite Code:${colors.reset} ${info.InviteCode}`);
        } else {
            logger.warn(`Could not fetch profile: ${profileRes.data.msg}`);
        }
    } catch (err) {
        logger.error(`Fetch profile failed: ${err.message}`);
    }
}

async function pharosSend(wallet, toAddress, amount, axiosInstance, pharosJwt) {
    let txHash = '';
    try {
        const amountParsed = ethers.parseEther(amount);
        logger.loading(`Sending ${amount} PHRS to ${toAddress}...`);

        const tx = await wallet.sendTransaction({
            to: toAddress,
            value: amountParsed,
        });

        logger.info(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        txHash = receipt.hash;
        logger.success(`Transaction confirmed! Block: ${receipt.blockNumber}`);

    } catch (err) {
        logger.error(`PHRS Send (on-chain) failed: ${err.message}`);
        return false;
    }

    if (txHash) {
        try {
            logger.loading("Verifying 'Send' task (ID 401) with Pharos API...");
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${pharosJwt}`;
            axiosInstance.defaults.headers.common['Referer'] = 'https://testnet.pharosnetwork.xyz/';

            const verifyBody = {
                address: wallet.address,
                task_id: 401,
                tx_hash: txHash
            };

            const verifyRes = await axiosInstance.post(`${PHAROS_API_BASE}/task/verify`, verifyBody);

            if (verifyRes.data.code === 0 && verifyRes.data.data.verified) {
                logger.success("Pharos API verified the 'Send' task successfully.");
            } else {
                logger.warn(`API verification failed: ${verifyRes.data.msg || 'Unknown error'}`);
            }
        } catch (err) {
            logger.error(`Pharos 'Send' task verification request failed: ${err.message}`);
        }
    }
    return true;
}

async function getAssetoJwt(wallet, axiosInstance) {
    axiosInstance.defaults.headers.common['Referer'] = 'https://testnet.asseto.finance/';
    delete axiosInstance.defaults.headers.common['Authorization'];

    try {
        logger.loading('Getting Asseto nonce...');
        const nonceRes = await axiosInstance.get(`${ASSETO_API_BASE}/nonce?address=${wallet.address}`);
        const { nonce, nonceId } = nonceRes.data.data;
        if (!nonce) {
            logger.error('Failed to get Asseto nonce.');
            return null;
        }

        logger.loading('Signing Asseto nonce...');
        const signature = await wallet.signMessage(nonce.toString());

        logger.loading('Logging into Asseto...');
        const loginRes = await axiosInstance.post(`${ASSETO_API_BASE}/login`, {
            nonceId: nonceId,
            signature: signature
        });

        if (loginRes.data.code === 10000 && loginRes.data.data) {
            logger.success('Successfully logged into Asseto.');
            return loginRes.data.data;
        } else {
            logger.error(`Asseto login failed: ${loginRes.data.message}`);
            return null;
        }
    } catch (err) {
        logger.error(`Asseto login process failed: ${err.message}`);
        return null;
    }
}

async function approveToken(wallet, tokenContract, spenderAddress, amount) {
    try {
        logger.loading(`Checking allowance for ${spenderAddress}...`);
        const allowance = await tokenContract.allowance(wallet.address, spenderAddress);

        if (allowance < BigInt(amount)) {
            logger.warn('Allowance is insufficient. Sending approve transaction...');
            const approveTx = await tokenContract.approve(spenderAddress, amount);
            logger.info(`Approve tx sent: ${approveTx.hash}`);
            await approveTx.wait();
            logger.success('Token approved successfully.');
        } else {
            logger.success('Allowance is sufficient.');
        }
        return true;
    } catch (err) {
        logger.error(`Token approve failed: ${err.message}`);
        return false;
    }
}

async function assetoSubscribe(wallet, amount) {
    try {
        const usdtContract = new ethers.Contract(USDT_ADDRESS_CONST, ERC20_ABI, wallet);
        const cashPlusContract = new ethers.Contract(CASHPLUS_ADDRESS, CASHPLUS_ABI, wallet);

        const usdtDecimals = 6;
        const amountParsed = ethers.parseUnits(amount, usdtDecimals);

        logger.info(`Subscribing with ${amount} USDT...`);

        const approved = await approveToken(wallet, usdtContract, CASHPLUS_ADDRESS, amountParsed);
        if (!approved) return false;

        logger.loading('Sending subscribe transaction...');
        const tx = await cashPlusContract.subscribe(USDT_ADDRESS_CONST, amountParsed);
        logger.info(`Subscribe tx sent: ${tx.hash}`);
        await tx.wait();
        logger.success(`Subscribe successful for ${amount} USDT.`);
        return true;

    } catch (err) {
        logger.error(`Asseto Subscribe failed: ${err.message.slice(0, 200)}...`);
        return false;
    }
}

async function assetoRedeem(wallet, amount) {
    try {
        const cashPlusContract = new ethers.Contract(CASHPLUS_ADDRESS, [...CASHPLUS_ABI, ...ERC20_ABI], wallet);

        const cashPlusDecimals = 18;
        const amountParsed = ethers.parseUnits(amount, cashPlusDecimals);

        logger.info(`Redeeming ${amount} CASH+...`);

        const approved = await approveToken(wallet, cashPlusContract, CASHPLUS_ADDRESS, amountParsed);
        if (!approved) return false;

        logger.loading('Sending redemption transaction...');
        const tx = await cashPlusContract.redemption(USDT_ADDRESS_CONST, amountParsed);
        logger.info(`Redeem tx sent: ${tx.hash}`);
        await tx.wait();
        logger.success(`Redeem successful for ${amount} CASH+.`);
        return true;

    } catch (err) {
        logger.error(`Asseto Redeem failed: ${err.message.slice(0, 200)}...`);
        return false;
    }
}

function tokenBySymbol(sym) {
    const key = (sym || '').toUpperCase();
    if (!TOKENS[key]) throw new Error(`Unsupported token symbol: ${sym}`);
    return TOKENS[key];
}

async function ensureApprovalIfNeededFaroswap(wallet, fromToken, amountWei) {
    if (fromToken.isNative) return true;
    const erc20 = new ethers.Contract(fromToken.address, ERC20_ABI, wallet);
    return approveToken(wallet, erc20, FARO_DODO_PROXY, amountWei);
}

async function getDodoRoute(axiosInstance, { chainId, fromTokenAddress, toTokenAddress, fromAmountWei, userAddress }) {
    try {
        const deadlineSec = Math.floor(Date.now() / 1000) + 900;
        const params = new URLSearchParams({
            chainId: String(chainId),
            deadLine: String(deadlineSec),
            apikey: DODO_APIKEY,
            slippage: String(FAROSWAP_SLIPPAGE),
            source: ROUTE_SOURCE,
            toTokenAddress,
            fromTokenAddress,
            userAddr: userAddress,
            estimateGas: 'true',
            fromAmount: fromAmountWei.toString(),
        });

        const headers = {
            'accept': 'application/json, text/plain, */*',
            'referer': FAROSWAP_REFERER,
        };

        const url = `${DODO_ROUTE_ENDPOINT}?${params.toString()}`;
        const res = await axiosInstance.get(url, { headers });

        if (!res.data || !res.data.data || !res.data.data.data) {
            throw new Error(`Route not available (keys: ${Object.keys(res.data || {}).join(', ')})`);
        }

        const r = res.data.data;

        return {
            to: r.to,
            data: r.data,
            gasLimit: r.gasLimit,
            value: r.value,
            minReturnAmount: r.minReturnAmount,
        };
    } catch (err) {
        throw new Error(`Failed to get DODO route: ${err.message}`);
    }
}

const FARO_PAIRS = [
    { label: 'PHRS → USDT', from: 'PHRS', to: 'USDT' },
    { label: 'PHRS → USDC', from: 'PHRS', to: 'USDC' },
    { label: 'USDT → PHRS', from: 'USDT', to: 'PHRS' },
    { label: 'USDC → PHRS', from: 'USDC', to: 'PHRS' },
    { label: 'USDT → USDC', from: 'USDT', to: 'USDC' },
    { label: 'USDC → USDT', from: 'USDC', to: 'USDT' },
    { label: 'WPHRS → USDT', from: 'WPHRS', to: 'USDT' },
    { label: 'PHRS → WPHRS', from: 'PHRS', to: 'WPHRS' },
];

async function selectFaroPair(rl) {
    console.log('\n--- FaroSwap Pairs ---');
    FARO_PAIRS.forEach((p, i) => console.log(`${i + 1}. ${p.label}`));
    console.log(`${FARO_PAIRS.length + 1}. Custom pair (manual tokens)`);

    const choice = await askQuestion(`${colors.yellow}[?] Select a pair (1-${FARO_PAIRS.length + 1}): ${colors.reset}`, rl);
    const idx = parseInt(choice.trim(), 10);

    if (idx >= 1 && idx <= FARO_PAIRS.length) {
        const sel = FARO_PAIRS[idx - 1];
        return { fromSym: sel.from, toSym: sel.to };
    }

    const fromSym = (await askQuestion(`${colors.yellow}[?] From token (PHRS/USDT/USDC/WPHRS): ${colors.reset}`, rl)).trim().toUpperCase();
    const toSym = (await askQuestion(`${colors.yellow}[?] To token (PHRS/USDT/USDC/WPHRS): ${colors.reset}`, rl)).trim().toUpperCase();
    return { fromSym, toSym };
}

async function runFaroswapSwapTask(accounts, proxies, rl, provider) {
    logger.step('Starting FaroSwap Swap Task...');

    const { fromSym, toSym } = await selectFaroPair(rl);

    const amount = (await askQuestion(`${colors.yellow}[?] Amount per account (in ${fromSym}, e.g., 0.005): ${colors.reset}`, rl)).trim();
    const numTx = parseInt(await askQuestion(`${colors.yellow}[?] Transactions per account: ${colors.reset}`, rl), 10);

    if (!amount || isNaN(Number(amount)) || numTx <= 0) {
        logger.error('Invalid amount or transactions count.');
        return;
    }

    let fromToken, toToken;
    try {
        fromToken = tokenBySymbol(fromSym);
        toToken = tokenBySymbol(toSym);
    } catch (e) {
        logger.error(e.message);
        return;
    }

    logger.info(`Pair: ${fromSym} → ${toSym}`);
    logger.info(`Slippage is ${FAROSWAP_SLIPPAGE}%`);
    logger.info(`Route source: ${ROUTE_SOURCE}`);

    for (const account of accounts) {
        logger.wallet(`--- Processing Account ${account.index} ---`);
        const proxyAgent = getProxyAgent(proxies);
        const axiosInstance = createAxiosInstance(proxyAgent);
        axiosInstance.defaults.headers.common['Referer'] = FAROSWAP_REFERER;

        const wallet = new ethers.Wallet(account.pk, provider);

        for (let i = 0; i < numTx; i++) {
            try {
                logger.loading(`Swap ${i + 1}/${numTx}: ${amount} ${fromSym} → ${toSym}`);

                const amountWei = ethers.parseUnits(amount, fromToken.decimals);

                const ok = await ensureApprovalIfNeededFaroswap(wallet, fromToken, amountWei);
                if (!ok) {
                    logger.error('Approval step failed.');
                    break;
                }

                const route = await getDodoRoute(axiosInstance, {
                    chainId: CHAIN_ID,
                    fromTokenAddress: fromToken.address,
                    toTokenAddress: toToken.address,
                    fromAmountWei: amountWei,
                    userAddress: wallet.address
                });

                const txReq = {
                    to: route.to,
                    data: route.data,
                    gasLimit: route.gasLimit ? ethers.toBeHex(BigInt(route.gasLimit)) : undefined,
                    value: fromToken.isNative ? ethers.toBeHex(BigInt(route.value || '0')) : undefined
                };

                logger.loading('Submitting swap transaction...');
                const tx = await wallet.sendTransaction(txReq);
                logger.info(`Tx sent: ${tx.hash}`);
                const rcpt = await tx.wait();
                if (rcpt.status !== 1) throw new Error('Swap transaction reverted.');
                logger.success(`Swap success. Block: ${rcpt.blockNumber}`);
                logger.info(`Min return (raw): ${route.minReturnAmount}`);

                await delay(4000);
            } catch (err) {
                logger.error(`Swap failed: ${err.message}`);
                await delay(4000);
            }
        }
        await delay(3000);
    }
    logger.step('FaroSwap task complete for all accounts.');
}

async function runFaroswapAddLiquidityTask(accounts, proxies, rl, provider) {
    logger.step('Starting FaroSwap Add Liquidity (WPHRS/USDT) Task...');

    const numTxInput = await askQuestion(`${colors.yellow}[?] Transactions per account: ${colors.reset}`, rl);
    const numTx = parseInt(numTxInput.trim(), 10);

    if (isNaN(numTx) || numTx <= 0) {
        logger.error('Invalid transactions count. Returning to menu.');
        return;
    }

    logger.info(`Will add liquidity with fixed amounts:`);
    logger.info(` - ${ethers.formatUnits(LIQUIDITY_AMOUNT_A_WEI, LIQUIDITY_TOKEN_A_OBJ.decimals)} ${LIQUIDITY_TOKEN_A_OBJ.symbol}`);
    logger.info(` - ${ethers.formatUnits(LIQUIDITY_AMOUNT_B_WEI, LIQUIDITY_TOKEN_B_OBJ.decimals)} ${LIQUIDITY_TOKEN_B_OBJ.symbol}`);

    for (const account of accounts) {
        logger.wallet(`--- Processing Account ${account.index} ---`);
        const wallet = new ethers.Wallet(account.pk, provider);
        const tokenAContract = new ethers.Contract(LIQUIDITY_TOKEN_A_OBJ.address, ERC20_ABI, wallet);
        const tokenBContract = new ethers.Contract(LIQUIDITY_TOKEN_B_OBJ.address, ERC20_ABI, wallet);
        const routerContract = new ethers.Contract(FAROSWAP_LIQUIDITY_ROUTER_ADDRESS, FAROSWAP_LIQUIDITY_ROUTER_ABI, wallet);

        for (let i = 0; i < numTx; i++) {
            logger.loading(`Starting transaction ${i + 1} of ${numTx} for account ${account.index}`);
            try {

                logger.loading(`Approving ${LIQUIDITY_TOKEN_A_OBJ.symbol}...`);
                const approvedA = await approveToken(wallet, tokenAContract, FAROSWAP_LIQUIDITY_ROUTER_ADDRESS, LIQUIDITY_AMOUNT_A_WEI);
                if (!approvedA) {
                    logger.error(`Approval failed for ${LIQUIDITY_TOKEN_A_OBJ.symbol}. Skipping tx.`);
                    continue;
                }
                logger.loading(`Approving ${LIQUIDITY_TOKEN_B_OBJ.symbol}...`);
                const approvedB = await approveToken(wallet, tokenBContract, FAROSWAP_LIQUIDITY_ROUTER_ADDRESS, LIQUIDITY_AMOUNT_B_WEI);
                if (!approvedB) {
                    logger.error(`Approval failed for ${LIQUIDITY_TOKEN_B_OBJ.symbol}. Skipping tx.`);
                    continue;
                }
                const deadline = Math.floor(Date.now() / 1000) + 900;
                logger.loading('Sending addLiquidity transaction...');

                const tx = await routerContract.addLiquidity(
                    LIQUIDITY_TOKEN_A_OBJ.address,
                    LIQUIDITY_TOKEN_B_OBJ.address,
                    LIQUIDITY_FEE_UINT,
                    LIQUIDITY_AMOUNT_A_WEI,
                    LIQUIDITY_AMOUNT_B_WEI,
                    LIQUIDITY_AMOUNT_A_MIN_WEI,
                    LIQUIDITY_AMOUNT_B_MIN_WEI,
                    wallet.address,
                    deadline
                );

                logger.info(`Add Liquidity tx sent: ${tx.hash}`);
                const receipt = await tx.wait();
                if (receipt.status !== 1) throw new Error('Add Liquidity transaction reverted.');

                logger.success(`Add Liquidity success! Block: ${receipt.blockNumber}`);

                await delay(10000);

            } catch (err) {
                logger.error(`Add Liquidity failed: ${err.message.slice(0, 200)}...`);
                await delay(5000);
            }
        }
        await delay(3000);
    }
    logger.step('FaroSwap Add Liquidity task complete for all accounts.');
}

async function runFaroswapMenu(accounts, proxies, rl, provider) {
    logger.step('--- FaroSwap Menu ---');
    console.log('1. Swap Tokens');
    console.log('2. Add Liquidity');
    console.log('3. Back to Main Menu');

    const choice = await askQuestion(`${colors.yellow}[?] Select an option (1-3): ${colors.reset}`, rl);

    switch (choice.trim()) {
        case '1':
            await runFaroswapSwapTask(accounts, proxies, rl, provider);
            break;
        case '2':
            await runFaroswapAddLiquidityTask(accounts, proxies, rl, provider);
            break;
        case '3':
            logger.info('Returning to main menu...');
            return;
        default:
            logger.error('Invalid option. Returning to main menu.');
    }
}

/**
 * * @param {ethers.Wallet} wallet
 * @param {string} proxyString
 * @returns {Promise<{success: boolean, txHash: string | null}>}
 */
async function claimFaucet(wallet, proxyString) {
    const claimUrl = 'https://api.dodoex.io/gas-faucet-server/faucet/claim';
    const payload = {
        chainId: CHAIN_ID,
        address: wallet.address
    };
    const headers = {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "priority": "u=1, i",
        "Referer": "https://faroswap.xyz/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    };

    let agent = null;
    let proxyHost = 'None';
    if (proxyString) {
        try {
            agent = new HttpsProxyAgent(proxyString);
            proxyHost = new URL(proxyString).hostname;
        } catch (e) {
            logger.error(`Proxy format not valid: ${proxyString}. Using direct mode.`);
            proxyHost = 'Invalid Format';
        }
    }

    try {
        logger.loading(`Attempting claim for wallet: ${wallet.address} (Proxy: ${proxyHost})`);
        const response = await axios.post(claimUrl, payload, {
            headers,
            httpsAgent: agent
        });

        if (response.data && response.data.code === 0) {
            logger.success(`SUCCESS: ${response.data.msg}`);
            saveRandomWallet(wallet);
            return { success: true, txHash: response.data.data.txHash };
        } else {
            logger.warn(`FAILED: ${response.data.msg || 'Unknown server error'}`);
            return { success: false, txHash: null };
        }
    } catch (error) {
        logger.error(`ERROR: Failed to send request for ${wallet.address} (Proxy: ${proxyHost})`);
        if (error.response) {
            logger.error(`   - Status: ${error.response.status}`);
            logger.error(`   - Data: ${JSON.stringify(error.response.data)}`);
        } else {
            logger.error(`   - Message: ${error.message}`);
        }
        return { success: false, txHash: null };
    }
}

async function sendPHRS(senderWallet, destinationAddress, provider) {
    logger.loading(`Attempting to send ${PHRS_TO_SEND} PHRS from ${senderWallet.address} to ${destinationAddress}...`);

    try {
        const signer = senderWallet.connect(provider);
        const tx = {
            to: destinationAddress,
            value: ethers.parseEther(PHRS_TO_SEND)
        };
        const txResponse = await signer.sendTransaction(tx);
        logger.loading(`Transaction sent. Waiting for confirmation... (Hash: ${txResponse.hash})`);
        await txResponse.wait();
        logger.success('Transaction complete!');
        logger.info(`View on explorer: ${EXPLORER_URL}/tx/${txResponse.hash}`);
    } catch (error) {
        logger.error(`Transaction failed: ${error.message}`);
        if (error.code === 'INSUFFICIENT_FUNDS' || (error.message && error.message.includes('insufficient funds'))) {
            logger.error('   - Cause: Insufficient funds. Faucet claim might have failed or RPC node is slow.');
        } else if (error.code === 'CALL_EXCEPTION') {
            logger.error('   - Cause: CALL_EXCEPTION. This often means insufficient funds or an issue with the destination address.');
        }
    }
}

async function runFaucetTask(accounts, proxies, rl, provider) {
    logger.step('--- Starting Faucet Claim & Send Task ---');

    if (!proxies || proxies.length === 0) {
        logger.error('No proxies loaded. This task requires proxies. Returning to menu.');
        return;
    }
    logger.info(`Loaded ${proxies.length} proxies for this task.`);

    const numWalletsStr = await askQuestion(`${colors.yellow}[?] How many wallets do you want to process? ${colors.reset}`, rl);
    const numWallets = parseInt(numWalletsStr, 10);

    if (isNaN(numWallets) || numWallets <= 0) {
        logger.error('Invalid input. Please enter a positive number. Returning to menu.');
        return;
    }
    logger.info(`OK, processing ${numWallets} wallet(s)...`);

    const destinationAddress = await askQuestion(`${colors.yellow}[?] Enter your destination address: ${colors.reset}`, rl);

    if (!ethers.isAddress(destinationAddress)) {
        logger.error('Invalid destination address. Returning to menu.');
        return;
    }

    logger.info(`All successful claims will send ${PHRS_TO_SEND} PHRS to: ${destinationAddress}`);

    for (let i = 0; i < numWallets; i++) {
        logger.step(`--- Processing Wallet ${i + 1} / ${numWallets} ---`);

        const currentProxy = proxies[i % proxies.length];
        const wallet = ethers.Wallet.createRandom();

        const claimResult = await claimFaucet(wallet, currentProxy);

        if (claimResult.success && claimResult.txHash) {

            logger.info('Faucet claim successful. Waiting for faucet funds to arrive...');
            logger.loading(`Waiting for confirmation of Tx: ${claimResult.txHash}`);

            try {
                const receipt = await provider.waitForTransaction(claimResult.txHash, 1, 60000);

                if (receipt.status === 1) {
                    logger.success(`Faucet funds confirmed in block ${receipt.blockNumber}.`);
                    logger.info('Waiting 5 seconds for RPC node to sync balance...');
                    await delay(5000); 

                    logger.info('Now, sending PHRS...');
                    await sendPHRS(wallet, destinationAddress, provider);
                } else {
                    logger.error(`Faucet transaction FAILED (reverted). Tx: ${claimResult.txHash}`);
                    logger.warn('Skipping PHRS send for this wallet.');
                }
            } catch (waitError) {
                logger.error(`Error waiting for faucet transaction: ${waitError.message}`);
                logger.warn('Skipping PHRS send for this wallet.');
            }
        } else {
            logger.warn('Faucet claim failed. Skipping PHRS send for this wallet.');
        }

        if (i < numWallets - 1) {
            logger.info(`Wallet ${i + 1} complete. Waiting 2 seconds before next...`);
            await delay(2000); 
        }
    }

    logger.step('Faucet task complete for all wallets.');
}

async function showMainMenu() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {

        logger.banner();

        const proxies = loadProxies();
        const accounts = loadAccounts();
        const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);

        logger.step('Starting Pharos Login, Check-in & Info Fetch for all accounts...');
        for (const account of accounts) {
            logger.wallet(`--- Processing Account ${account.index} ---`);
            const proxyAgent = getProxyAgent(proxies);
            const axiosInstance = createAxiosInstance(proxyAgent);
            const wallet = new ethers.Wallet(account.pk, provider);

            const pharosJwt = await pharosLogin(wallet, axiosInstance);

            if (!pharosJwt) {
                logger.error(`Pharos login failed for account ${account.index}. Skipping.`);
                await delay(3000);
                continue;
            }

            await pharosCheckInAndProfile(wallet, pharosJwt, axiosInstance);
            await delay(3000);
        }
        logger.step('Initial Check-in & Profile Fetch complete for all accounts.');

        while (true) {
            console.log('\n--- Main Menu ---');
            console.log('1. Pharos Send Task');
            console.log('2. Asseto Subscribe/Redeem Task');
            console.log('3. FaroSwap (Swap / Add Liquidity)');
            console.log('4. Faucet');
            console.log('5. Exit');

            const choice = await askQuestion(`${colors.yellow}[?] Select an option (1-5): ${colors.reset}`, rl);

            switch (choice.trim()) {
                case '1':
                    await runPharosSend(accounts, proxies, rl, provider);
                    break;
                case '2':
                    await runAssetoTask(accounts, proxies, rl, provider);
                    break;
                case '3':
                    await runFaroswapMenu(accounts, proxies, rl, provider);
                    break;
                case '4': 
                    await runFaucetTask(accounts, proxies, rl, provider);
                    break;
                case '5':
                    logger.info('Exiting. Goodbye!');
                    rl.close();
                    return;
                default:
                    logger.error('Invalid option. Please choose 1-5.');
            }
        }
    } catch (err) {
        logger.error(`An unexpected error occurred: ${err.message}`);
        rl.close();
    }
}

async function runPharosSend(accounts, proxies, rl, provider) {
    logger.step('Starting Pharos Send Task...');

    const amount = await askQuestion(`${colors.yellow}[?] Enter PHRS amount to send (e.g., 0.001): ${colors.reset}`, rl);
    const numTx = parseInt(await askQuestion(`${colors.yellow}[?] Enter number of transactions per account: ${colors.reset}`, rl), 10);
    const addressMode = await askQuestion(`${colors.yellow}[?] Choose address mode: (1) Manual (2) Random: ${colors.reset}`, rl);

    let manualAddress = '';
    if (addressMode === '1') {
        manualAddress = await askQuestion(`${colors.yellow}[?] Enter the single recipient address: ${colors.reset}`, rl);
        if (!ethers.isAddress(manualAddress)) {
            logger.error('Invalid address.');
            return;
        }
    }

    const randomWallets = (addressMode === '2') ? loadRandomWallets() : [];

    for (const account of accounts) {
        logger.wallet(`--- Processing Account ${account.index} ---`);

        const proxyAgent = getProxyAgent(proxies);
        const axiosInstance = createAxiosInstance(proxyAgent);
        const wallet = new ethers.Wallet(account.pk, provider);

        const pharosJwt = await pharosLogin(wallet, axiosInstance);
        if (!pharosJwt) {
            logger.error(`Pharos login failed for account ${account.index}. Skipping 'Send' tasks for this account.`);
            await delay(3000);
            continue;
        }

        for (let i = 0; i < numTx; i++) {
            logger.loading(`Starting transaction ${i + 1} of ${numTx} for account ${account.index}`);
            let toAddress = manualAddress;

            if (addressMode === '2') {
                if (randomWallets.length > 0) {
                    toAddress = randomWallets[Math.floor(Math.random() * randomWallets.length)].address;
                } else {
                    logger.warn('No random wallets in wallets.json, generating a new one...');
                    const newWallet = ethers.Wallet.createRandom();
                    toAddress = newWallet.address;
                    saveRandomWallet(newWallet);
                    randomWallets.push({ address: newWallet.address, privateKey: newWallet.privateKey });
                }
            }

            if (toAddress.toLowerCase() === wallet.address.toLowerCase()) {
                logger.warn('Skipping send to self. Getting new random address.');
                const newWallet = ethers.Wallet.createRandom();
                toAddress = newWallet.address;
                saveRandomWallet(newWallet);
                randomWallets.push({ address: newWallet.address, privateKey: newWallet.privateKey });
            }

            await pharosSend(wallet, toAddress, amount, axiosInstance, pharosJwt);
            await delay(5000);
        }
        await delay(3000);
    }
    logger.step('Pharos Send task complete for all accounts.');
}

async function runAssetoTask(accounts, proxies, rl, provider) {
    logger.step('Starting Asseto Task...');

    console.log('--- Asseto Menu ---');
    console.log('1. Subscribe (Deposit USDT)');
    console.log('2. Redeem (Withdraw CASH+)');
    const choice = await askQuestion(`${colors.yellow}[?] Select an option (1-2): ${colors.reset}`, rl);

    if (choice !== '1' && choice !== '2') {
        logger.error('Invalid choice.');
        return;
    }

    const tokenName = (choice === '1') ? 'USDT' : 'CASH+';
    const amount = await askQuestion(`${colors.yellow}[?] Enter ${tokenName} amount (e.g., 1.5): ${colors.reset}`, rl);
    const numTx = parseInt(await askQuestion(`${colors.yellow}[?] Enter number of transactions per account: ${colors.reset}`, rl), 10);

    for (const account of accounts) {
        logger.wallet(`--- Processing Account ${account.index} ---`);
        const proxyAgent = getProxyAgent(proxies);
        const assetoAxiosInstance = createAxiosInstance(proxyAgent);
        const wallet = new ethers.Wallet(account.pk, provider);

        const assetoJwt = await getAssetoJwt(wallet, assetoAxiosInstance);
        if (!assetoJwt) {
            logger.error(`Could not log in to Asseto for account ${account.index}. Skipping.`);
            continue;
        }

        assetoAxiosInstance.defaults.headers.common['Authorization'] = assetoJwt;

        for (let i = 0; i < numTx; i++) {
            logger.loading(`Starting transaction ${i + 1} of ${numTx} for account ${account.index}`);

            if (choice === '1') {
                await assetoSubscribe(wallet, amount);
            } else {
                await assetoRedeem(wallet, amount);
            }
            await delay(10000);
        }
        await delay(3000);
    }
    logger.step('Asseto task complete for all accounts.');
}

showMainMenu();
