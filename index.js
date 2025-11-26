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

// --- Config & Constants ---
const PHAROS_RPC_URL = 'https://atlantic.dplabs-internal.com';
const CHAIN_ID = 688689;
const PHAROS_API_BASE = 'https://api.pharosnetwork.xyz';
const ASSETO_API_BASE = 'https://asseto.finance/api';

const CASHPLUS_ADDRESS = '0x56f4add11d723412d27a9e9433315401b351d6e3';
const USDT_ADDRESS_CONST = '0xe7e84b8b4f39c507499c40b4ac199b050e2882d5';

const FAROSWAP_REFERER = 'https://faroswap.xyz/';
const DODO_API = 'https://api.dodoex.io';
const DODO_ROUTE_ENDPOINT = `${DODO_API}/route-service/v2/widget/getdodoroute`;
const DODO_APIKEY = 'a37546505892e1a952';
const FARO_DODO_PROXY = '0x819829e5CF6e19F9fED92F6b4CC1edF45a2cC4A2';
const FAROSWAP_SLIPPAGE = 3.0;
const ROUTE_SOURCE = 'dodoV2AndMixWasm';

const FAROSWAP_LIQUIDITY_ROUTER_ADDRESS = '0xb93Cd1E38809607a00FF9CaB633db5CAA6130dD0';
const LIQUIDITY_TOKEN_A_OBJ = { symbol: 'WPHRS', address: '0x838800b758277CC111B2d48Ab01e5E164f8E9471', decimals: 18 };
const LIQUIDITY_TOKEN_B_OBJ = { symbol: 'USDT', address: '0xE7E84B8B4f39C507499c40B4ac199B050e2882d5', decimals: 6 };

// Fixed amounts for Liquidity Task
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
};

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address account) view returns (uint256)" 
];
const CASHPLUS_ABI = [
    "function subscribe(address uAddress, uint256 uAmount)",
    "function redemption(address uAddress, uint256 tokenAmount)"
];

const WALLETS_FILE = 'wallets.json';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Helpers ---

function loadProxies() {
    try {
        const data = fs.readFileSync('proxies.txt', 'utf8');
        const proxies = data.split('\n').filter(p => p.trim() !== '');
        if (proxies.length === 0) return [];
        logger.success(`Loaded ${proxies.length} proxies.`);
        return proxies;
    } catch (err) {
        logger.warn('proxies.txt not found. Running without proxies.');
        return [];
    }
}

function getProxyAgent(proxies) {
    if (!proxies || proxies.length === 0) return null;
    const proxyString = proxies[Math.floor(Math.random() * proxies.length)];
    return new HttpsProxyAgent(proxyString);
}

function createAxiosInstance(proxyAgent) {
    return axios.create({
        httpsAgent: proxyAgent,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    });
}

function loadAccounts() {
    const accounts = [];
    let i = 1;
    while (process.env[`PRIVATE_KEY_${i}`]) {
        accounts.push({ index: i, pk: process.env[`PRIVATE_KEY_${i}`] });
        i++;
    }
    if (accounts.length === 0) {
        logger.error('No accounts found in .env');
        process.exit(1);
    }
    return accounts;
}

function askQuestion(query, rl) {
    return new Promise(resolve => rl.question(query, resolve));
}

function loadRandomWallets() {
    try {
        if (fs.existsSync(WALLETS_FILE)) {
            return JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function saveRandomWallet(wallet) {
    const wallets = loadRandomWallets();
    wallets.push({ address: wallet.address, privateKey: wallet.privateKey });
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
}

// --- Pharos Auth & Info ---

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
    logger.loading('Pharos Login...');
    try {
        const domain = 'testnet.pharosnetwork.xyz';
        const chainId = CHAIN_ID.toString();
        const timestamp = new Date().toISOString();
        const nonce = Math.floor(Math.random() * 10000000).toString();
        const message = createPharosSiweMessage(wallet.address, chainId, domain, `https://${domain}`, nonce, timestamp);
        const signature = await wallet.signMessage(message);

        const res = await axiosInstance.post(`${PHAROS_API_BASE}/user/login`, {
            address: wallet.address, signature, wallet: "Rabby Wallet", nonce, chain_id: chainId, timestamp, domain
        });

        if (res.data.code === 0 && res.data.data.jwt) return res.data.data.jwt;
    } catch (err) { }
    return null;
}

async function pharosCheckInAndProfile(wallet, jwt, axiosInstance) {
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
    try {
        await axiosInstance.post(`${PHAROS_API_BASE}/sign/in`, { address: wallet.address });
        logger.success('Daily check-in done.');
    } catch (e) { }
    
    try {
        const res = await axiosInstance.get(`${PHAROS_API_BASE}/user/profile?address=${wallet.address}`);
        if (res.data.code === 0) {
            const info = res.data.data.user_info;
            console.log(`   > Points: ${info.TotalPoints} | Code: ${info.InviteCode}`);
        }
    } catch (e) { }
}

// --- Task Functions ---

async function approveToken(wallet, tokenContract, spenderAddress, amount) {
    try {
        const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
        if (allowance < BigInt(amount)) {
            logger.loading(`Approving token...`);
            const tx = await tokenContract.approve(spenderAddress, amount);
            await tx.wait();
            logger.success('Approved.');
        }
        return true;
    } catch (err) {
        logger.error(`Approve failed: ${err.message}`);
        return false;
    }
}

// --- 1. Pharos Send ---
async function pharosSendVerify(wallet, txHash, axiosInstance, pharosJwt) {
    try {
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${pharosJwt}`;
        await axiosInstance.post(`${PHAROS_API_BASE}/task/verify`, { address: wallet.address, task_id: 401, tx_hash: txHash });
        logger.success("Pharos Task 401 verified.");
    } catch (e) { }
}

async function runPharosSend(accounts, proxies, rl, provider, autoInput = null) {
    logger.step('Starting Pharos Send Task...');

    let amount, numTx;
    let targetAddress = null;

    if (autoInput) {
        amount = autoInput.amount;
        numTx = autoInput.numTx;
        targetAddress = autoInput.targetAddress; 

        if (targetAddress) {
            logger.info(`[AUTO] Using Manual Target: ${targetAddress}`);
        } else {
            logger.info(`[AUTO] Using Random/Generated Wallets.`);
        }
    } else {
        // Mode Manual Menu 1
        amount = await askQuestion(`${colors.yellow}[?] Enter PHRS amount (e.g., 0.001): ${colors.reset}`, rl);
        numTx = parseInt(await askQuestion(`${colors.yellow}[?] Txs per account: ${colors.reset}`, rl), 10);
        
        const mode = await askQuestion(`${colors.yellow}[?] (1) Input Address (2) Random: ${colors.reset}`, rl);
        if (mode === '1') {
            const inputAddr = await askQuestion(`${colors.yellow}[?] Enter Recipient Address: ${colors.reset}`, rl);
            if (ethers.isAddress(inputAddr)) {
                targetAddress = inputAddr;
            } else {
                logger.error('Invalid address. Switching to Random mode.');
            }
        }
    }

    const randomWallets = (!targetAddress) ? loadRandomWallets() : [];

    for (const account of accounts) {
        logger.wallet(`Account ${account.index}`);
        const proxyAgent = getProxyAgent(proxies);
        const axiosInstance = createAxiosInstance(proxyAgent);
        const wallet = new ethers.Wallet(account.pk, provider);
        const jwt = await pharosLogin(wallet, axiosInstance);
        if (!jwt) continue;

        for (let i = 0; i < numTx; i++) {
            logger.loading(`Tx ${i + 1}/${numTx}`);
            let toAddress = targetAddress;

            // Jika tidak ada targetAddress (Mode Random)
            if (!toAddress) {
                if (randomWallets.length === 0) {
                    const nw = ethers.Wallet.createRandom();
                    saveRandomWallet(nw);
                    randomWallets.push(nw);
                }
                toAddress = randomWallets[Math.floor(Math.random() * randomWallets.length)].address;

                // Prevent self-send di mode random
                if(toAddress.toLowerCase() === wallet.address.toLowerCase()) {
                     const nw = ethers.Wallet.createRandom();
                     saveRandomWallet(nw);
                     toAddress = nw.address;
                }
            }

            try {
                const tx = await wallet.sendTransaction({ to: toAddress, value: ethers.parseEther(amount) });
                logger.info(`Sent to ${toAddress.slice(0,6)}...${toAddress.slice(-4)}: ${tx.hash}`);
                await tx.wait();
                await pharosSendVerify(wallet, tx.hash, axiosInstance, jwt);
            } catch (err) { logger.error(`Send failed: ${err.message}`); }
            await delay(3000);
        }
    }
}

// --- 2. Asseto (Fixed Logic) ---
async function getAssetoJwt(wallet, axiosInstance) {
    try {
        const nr = await axiosInstance.get(`${ASSETO_API_BASE}/nonce?address=${wallet.address}`);
        const { nonce, nonceId } = nr.data.data;
        const sig = await wallet.signMessage(nonce.toString());
        const lr = await axiosInstance.post(`${ASSETO_API_BASE}/login`, { nonceId, signature: sig });
        return lr.data.data;
    } catch (e) { return null; }
}

async function runAssetoTask(accounts, proxies, rl, provider, autoInput = null) {
    logger.step('Starting Asseto Task...');

    let choice, amount, numTx;

    if (autoInput) {
        logger.info(`[AUTO] Will Subscribe USDT then Redeem CASH+ for ${autoInput.numTx} cycles.`);
        amount = autoInput.amount;
        numTx = autoInput.numTx;
        choice = 'AUTO';
    } else {
        console.log('1. Subscribe (USDT) | 2. Redeem (CASH+)');
        choice = await askQuestion(`${colors.yellow}[?] Choice: ${colors.reset}`, rl);
        amount = await askQuestion(`${colors.yellow}[?] Amount: ${colors.reset}`, rl);
        numTx = parseInt(await askQuestion(`${colors.yellow}[?] Txs per account: ${colors.reset}`, rl), 10);
    }

    const usdtDecimals = 6;
    const cashPlusDecimals = 18;

    for (const account of accounts) {
        logger.wallet(`Account ${account.index}`);
        const wallet = new ethers.Wallet(account.pk, provider);
        const proxyAgent = getProxyAgent(proxies);
        const axiosInstance = createAxiosInstance(proxyAgent);
        
        // Login Asseto
        const jwt = await getAssetoJwt(wallet, axiosInstance);
        if (!jwt) {
            logger.error('Asseto Login Failed. Skipping account.');
            continue;
        }
        axiosInstance.defaults.headers.common['Authorization'] = jwt;

        const usdt = new ethers.Contract(USDT_ADDRESS_CONST, ERC20_ABI, wallet);
        // Include ERC20 ABI in CashPlus to use balanceOf
        const cashPlus = new ethers.Contract(CASHPLUS_ADDRESS, [...CASHPLUS_ABI, ...ERC20_ABI], wallet);

        for (let i = 0; i < numTx; i++) {
            logger.loading(`Cycle ${i + 1}/${numTx}`);

            // --- 1. SUBSCRIBE ---
            if (choice === '1' || choice === 'AUTO') {
                try {
                    const amtWei = ethers.parseUnits(amount, usdtDecimals);
                    
                    // Balance Check
                    const usdtBal = await usdt.balanceOf(wallet.address);
                    if (usdtBal < amtWei) {
                         logger.error(`Insufficient USDT. Have: ${ethers.formatUnits(usdtBal,6)}`);
                    } else {
                        if(await approveToken(wallet, usdt, CASHPLUS_ADDRESS, amtWei)) {
                            logger.loading(`Subscribing ${amount} USDT...`);
                            // Gas Limit Manual to prevent estimation error
                            const tx = await cashPlus.subscribe(USDT_ADDRESS_CONST, amtWei, { gasLimit: 500000 });
                            await tx.wait();
                            logger.success(`Subscribed successfully.`);
                        }
                    }
                } catch(e) { logger.error(`Subscribe failed: ${e.message}`); }
            }

            if (choice === 'AUTO') {
                logger.loading('Waiting 8 seconds for balance update...');
                await delay(8000); 
            }

            // --- 2. REDEEM ---
            if (choice === '2' || choice === 'AUTO') {
                try {
                    const currentCashPlusBalance = await cashPlus.balanceOf(wallet.address);
                    const requestedAmountWei = ethers.parseUnits(amount, cashPlusDecimals);
                    let redeemAmountWei = requestedAmountWei;

                    // Adjust if balance < request
                    if (currentCashPlusBalance < requestedAmountWei) {
                        if (currentCashPlusBalance === 0n) {
                            logger.warn('CASH+ Balance is 0. Skipping Redeem.');
                            continue;
                        }
                        logger.warn(`Adjusting redeem to Max Balance: ${ethers.formatUnits(currentCashPlusBalance, 18)}`);
                        redeemAmountWei = currentCashPlusBalance;
                    }

                    if(await approveToken(wallet, cashPlus, CASHPLUS_ADDRESS, redeemAmountWei)) {
                        logger.loading(`Redeeming ${ethers.formatUnits(redeemAmountWei, 18)} CASH+...`);
                        const tx = await cashPlus.redemption(USDT_ADDRESS_CONST, redeemAmountWei, { gasLimit: 800000 });
                        await tx.wait();
                        logger.success(`Redeemed successfully.`);
                    }
                } catch(e) { logger.error(`Redeem failed: ${e.message}`); }
            }
            await delay(3000);
        }
    }
}

// --- 3. FaroSwap ---

async function getDodoRoute(axiosInstance, { fromToken, toToken, fromAmountWei, userAddress }) {
    try {
        const deadline = Math.floor(Date.now() / 1000) + 900;
        const params = new URLSearchParams({
            chainId: CHAIN_ID, deadLine: deadline, apikey: DODO_APIKEY, slippage: FAROSWAP_SLIPPAGE,
            source: ROUTE_SOURCE, toTokenAddress: toToken.address, fromTokenAddress: fromToken.address,
            userAddr: userAddress, estimateGas: 'true', fromAmount: fromAmountWei.toString()
        });
        const res = await axiosInstance.get(`${DODO_ROUTE_ENDPOINT}?${params.toString()}`);
        return res.data.data;
    } catch (e) { throw new Error(e.message); }
}

async function runFaroswapSwapTask(accounts, proxies, rl, provider, autoInput = null) {
    logger.step('Starting FaroSwap Swap Task...');
    
    let fromSym, toSym, amount, numTx;

    if (autoInput) {
        fromSym = 'PHRS'; toSym = 'USDT';
        amount = autoInput.amount;
        numTx = autoInput.numTx;
        logger.info(`[AUTO] Swap PHRS -> USDT | Amount: ${amount} | Txs: ${numTx}`);
    } else {
        const p = await askQuestion(`${colors.yellow}[?] From (PHRS/USDT): ${colors.reset}`, rl);
        fromSym = p.trim().toUpperCase();
        toSym = (fromSym === 'PHRS') ? 'USDT' : 'PHRS';
        amount = await askQuestion(`${colors.yellow}[?] Amount: ${colors.reset}`, rl);
        numTx = parseInt(await askQuestion(`${colors.yellow}[?] Txs: ${colors.reset}`, rl), 10);
    }

    const fromToken = TOKENS[fromSym];
    const toToken = TOKENS[toSym];

    for (const account of accounts) {
        logger.wallet(`Account ${account.index}`);
        const wallet = new ethers.Wallet(account.pk, provider);
        const axiosInstance = createAxiosInstance(getProxyAgent(proxies));
        axiosInstance.defaults.headers.common['Referer'] = FAROSWAP_REFERER;

        for (let i = 0; i < numTx; i++) {
            try {
                logger.loading(`Swap ${i+1}/${numTx}`);
                const amtWei = ethers.parseUnits(amount, fromToken.decimals);
                
                if (!fromToken.isNative) {
                    const erc20 = new ethers.Contract(fromToken.address, ERC20_ABI, wallet);
                    await approveToken(wallet, erc20, FARO_DODO_PROXY, amtWei);
                }

                const route = await getDodoRoute(axiosInstance, { fromToken, toToken, fromAmountWei: amtWei, userAddress: wallet.address });
                
                const txReq = {
                    to: route.to, data: route.data,
                    gasLimit: route.gasLimit ? BigInt(route.gasLimit) : undefined,
                    value: fromToken.isNative ? BigInt(route.value || 0) : 0n
                };

                const tx = await wallet.sendTransaction(txReq);
                await tx.wait();
                logger.success(`Swap Confirmed.`);
            } catch (err) { logger.error(`Swap failed: ${err.message}`); }
            await delay(4000);
        }
    }
}

async function runFaroswapAddLiquidityTask(accounts, proxies, rl, provider, autoInput = null) {
    logger.step('Starting FaroSwap Liquidity Task...');
    
    let numTx;
    if (autoInput) {
        numTx = autoInput.numTx;
        logger.info(`[AUTO] Adding Liquidity ${numTx} times.`);
    } else {
        numTx = parseInt(await askQuestion(`${colors.yellow}[?] Txs per account: ${colors.reset}`, rl), 10);
    }

    for (const account of accounts) {
        logger.wallet(`Account ${account.index}`);
        const wallet = new ethers.Wallet(account.pk, provider);
        const router = new ethers.Contract(FAROSWAP_LIQUIDITY_ROUTER_ADDRESS, FAROSWAP_LIQUIDITY_ROUTER_ABI, wallet);
        const tA = new ethers.Contract(LIQUIDITY_TOKEN_A_OBJ.address, ERC20_ABI, wallet);
        const tB = new ethers.Contract(LIQUIDITY_TOKEN_B_OBJ.address, ERC20_ABI, wallet);

        for (let i = 0; i < numTx; i++) {
            try {
                logger.loading(`Liquidity ${i+1}/${numTx}`);
                if (!await approveToken(wallet, tA, FAROSWAP_LIQUIDITY_ROUTER_ADDRESS, LIQUIDITY_AMOUNT_A_WEI)) continue;
                if (!await approveToken(wallet, tB, FAROSWAP_LIQUIDITY_ROUTER_ADDRESS, LIQUIDITY_AMOUNT_B_WEI)) continue;

                const tx = await router.addLiquidity(
                    LIQUIDITY_TOKEN_A_OBJ.address, LIQUIDITY_TOKEN_B_OBJ.address, LIQUIDITY_FEE_UINT,
                    LIQUIDITY_AMOUNT_A_WEI, LIQUIDITY_AMOUNT_B_WEI,
                    LIQUIDITY_AMOUNT_A_MIN_WEI, LIQUIDITY_AMOUNT_B_MIN_WEI,
                    wallet.address, Math.floor(Date.now()/1000) + 900
                );
                await tx.wait();
                logger.success(`Liquidity Added.`);
            } catch (err) { logger.error(`Liquidity failed: ${err.message}`); }
            await delay(5000);
        }
    }
}

async function runFaroswapMenu(accounts, proxies, rl, provider) {
    console.log('1. Swap | 2. Add Liquidity');
    const c = await askQuestion('[?] Choice: ', rl);
    if (c === '1') await runFaroswapSwapTask(accounts, proxies, rl, provider);
    if (c === '2') await runFaroswapAddLiquidityTask(accounts, proxies, rl, provider);
}

// --- 4. Faucet ---
async function claimFaucet(wallet, proxyString) {
    const claimUrl = 'https://api.dodoex.io/gas-faucet-server/faucet/claim';
    const payload = { chainId: CHAIN_ID, address: wallet.address };
    const headers = {
        "content-type": "application/json",
        "Referer": "https://faroswap.xyz/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    };
    
    let agent = null;
    if (proxyString) {
        try { agent = new HttpsProxyAgent(proxyString); } catch(e) {}
    }

    try {
        const res = await axios.post(claimUrl, payload, { headers, httpsAgent: agent });
        if (res.data && res.data.code === 0) {
            saveRandomWallet(wallet);
            return { success: true, txHash: res.data.data.txHash };
        }
        return { success: false };
    } catch (e) { return { success: false }; }
}

async function runFaucetTask(accounts, proxies, rl, provider) {
    logger.step('Faucet Task (Generates NEW Wallets)');
    if (!proxies || proxies.length === 0) {
        logger.error('Proxies required for faucet.');
        return;
    }
    const num = parseInt(await askQuestion(`${colors.yellow}[?] How many wallets: ${colors.reset}`, rl));
    const dest = await askQuestion(`${colors.yellow}[?] Dest Address for PHRS: ${colors.reset}`, rl);
    if (!ethers.isAddress(dest)) return;

    for(let i=0; i<num; i++) {
        const w = ethers.Wallet.createRandom();
        const proxy = proxies[i % proxies.length];
        logger.info(`Claiming for ${w.address}...`);
        
        const res = await claimFaucet(w, proxy);
        if (res.success) {
            logger.success(`Claimed. Waiting confirmation...`);
            try {
                await provider.waitForTransaction(res.txHash, 1, 60000);
                await delay(5000);
                const signer = w.connect(provider);
                const tx = await signer.sendTransaction({ to: dest, value: ethers.parseEther(PHRS_TO_SEND) });
                logger.success(`Sent PHRS to destination: ${tx.hash}`);
            } catch(e) { logger.error(`Transfer failed: ${e.message}`); }
        } else {
            logger.warn('Claim failed.');
        }
        await delay(2000);
    }
}

// --- MAIN RUN ALL ---

async function runAllDailyTasks(accounts, proxies, rl, provider) {
    logger.banner();
    logger.step('🚀 STARTING ALL DAILY TASKS AUTOMATION 🚀');
    
    const amount = await askQuestion(`${colors.yellow}[?] Enter Token Amount (e.g. 0.001): ${colors.reset}`, rl);
    const numTxStr = await askQuestion(`${colors.yellow}[?] Enter TXs per module (e.g. 3): ${colors.reset}`, rl);
    const numTx = parseInt(numTxStr, 10);
    
    // NEW: Ask for Target Address specifically for the "Send" task
    const targetAddrInput = await askQuestion(`${colors.yellow}[?] [Optional] Target Address for Send Task (Leave empty for Random): ${colors.reset}`, rl);
    const targetAddress = ethers.isAddress(targetAddrInput.trim()) ? targetAddrInput.trim() : null;

    const autoConfig = { amount, numTx, targetAddress };

    // 1. Pharos Send
    logger.step('>>> [1/4] Running Pharos Send Task...');
    await runPharosSend(accounts, proxies, rl, provider, autoConfig);
    await delay(3000);

    // 2. Asseto (Auto Subscribe & Redeem)
    logger.step('>>> [2/4] Running Asseto Task (Subscribe & Redeem)...');
    await runAssetoTask(accounts, proxies, rl, provider, autoConfig);
    await delay(3000);

    // 3. FaroSwap Swap
    logger.step('>>> [3/4] Running FaroSwap SWAP (PHRS -> USDT)...');
    await runFaroswapSwapTask(accounts, proxies, rl, provider, autoConfig);
    await delay(3000);

    // 4. FaroSwap Liquidity
    logger.step('>>> [4/4] Running FaroSwap ADD LIQUIDITY...');
    await runFaroswapAddLiquidityTask(accounts, proxies, rl, provider, autoConfig);

    logger.success('✅ ALL DAILY TASKS COMPLETED FOR ALL ACCOUNTS.');
}

// --- Main Menu ---

async function showMainMenu() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const proxies = loadProxies();
    const accounts = loadAccounts();
    const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);

    logger.banner();
    
    // Initial Login Check
    logger.step('Initial Login & Check-in...');
    for (const acc of accounts) {
        const w = new ethers.Wallet(acc.pk, provider);
        const jwt = await pharosLogin(w, createAxiosInstance(getProxyAgent(proxies)));
        if (jwt) await pharosCheckInAndProfile(w, jwt, createAxiosInstance(getProxyAgent(proxies)));
    }

    while (true) {
        console.log(`\n${colors.cyan}--- Main Menu ---${colors.reset}`);
        console.log(`${colors.gold}0. 🚀 Run ALL Daily Tasks (Send, Asseto, Swap, Liquidity)${colors.reset}`);
        console.log('1. Pharos Send Task');
        console.log('2. Asseto Task');
        console.log('3. FaroSwap Task');
        console.log('4. Faucet (New Wallets)');
        console.log('5. Exit');

        const choice = await askQuestion(`${colors.yellow}[?] Select: ${colors.reset}`, rl);

        try {
            switch (choice.trim()) {
                case '0': await runAllDailyTasks(accounts, proxies, rl, provider); break;
                case '1': await runPharosSend(accounts, proxies, rl, provider); break;
                case '2': await runAssetoTask(accounts, proxies, rl, provider); break;
                case '3': await runFaroswapMenu(accounts, proxies, rl, provider); break;
                case '4': await runFaucetTask(accounts, proxies, rl, provider); break;
                case '5': process.exit(0);
                default: logger.error('Invalid option.');
            }
        } catch (e) { logger.error(`Error: ${e.message}`); }
    }
}

showMainMenu();
