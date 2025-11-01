(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/wallet-context.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalletProvider",
    ()=>WalletProvider,
    "getAccounts",
    ()=>getAccounts,
    "getEthersProvider",
    ()=>getEthersProvider,
    "useWallet",
    ()=>useWallet
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$ethers$2f$lib$2e$esm$2f$ethers$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__ethers$3e$__ = __turbopack_context__.i("[project]/node_modules/ethers/lib.esm/ethers.js [app-client] (ecmascript) <export * as ethers>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
const WalletContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function WalletProvider({ children }) {
    _s();
    const [account, setAccount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [balance, setBalance] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Check if we're in development and add a mock ethereum provider
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletProvider.useEffect": ()=>{
            if (("TURBOPACK compile-time value", "object") !== 'undefined' && !window.ethereum && ("TURBOPACK compile-time value", "development") === 'development') {
                console.warn('No Ethereum provider found. Install MetaMask or another Web3 wallet.');
            }
        }
    }["WalletProvider.useEffect"], []);
    const connect = async ()=>{
        const ethereum = window.ethereum;
        if (!ethereum) {
            alert("Please install MetaMask or another Web3 wallet");
            return;
        }
        if (typeof ethereum.request !== 'function') {
            alert("Ethereum provider is not properly initialized");
            return;
        }
        try {
            const accounts = await ethereum.request({
                method: "eth_requestAccounts"
            });
            if (!accounts || accounts.length === 0) {
                alert("No accounts found. Please check your wallet.");
                return;
            }
            setAccount(accounts[0]);
            // Get balance
            const balanceWei = await ethereum.request({
                method: "eth_getBalance",
                params: [
                    accounts[0],
                    "latest"
                ]
            });
            const balanceNum = Number.parseInt(balanceWei, 16) / 1e18;
            setBalance(balanceNum.toFixed(4));
            // Switch to BNB Smart Chain (chainId 56)
            try {
                await ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [
                        {
                            chainId: "0x38"
                        }
                    ]
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    // Chain not added, add it
                    await ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [
                            {
                                chainId: "0x38",
                                chainName: "BNB Smart Chain",
                                nativeCurrency: {
                                    name: "BNB",
                                    symbol: "BNB",
                                    decimals: 18
                                },
                                rpcUrls: [
                                    "https://bsc-dataseed1.binance.org:443"
                                ],
                                blockExplorerUrls: [
                                    "https://bscscan.com"
                                ]
                            }
                        ]
                    });
                }
            }
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            alert(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    const disconnect = ()=>{
        setAccount(null);
        setBalance(null);
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletProvider.useEffect": ()=>{
            const ethereum = window.ethereum;
            if (ethereum) {
                const handleAccountsChanged = {
                    "WalletProvider.useEffect.handleAccountsChanged": (...args)=>{
                        const accounts = args[0];
                        if (accounts.length === 0) {
                            disconnect();
                        } else {
                            setAccount(accounts[0]);
                        }
                    }
                }["WalletProvider.useEffect.handleAccountsChanged"];
                const handleChainChanged = {
                    "WalletProvider.useEffect.handleChainChanged": (...args)=>{
                        window.location.reload();
                    }
                }["WalletProvider.useEffect.handleChainChanged"];
                // Listen for account changes
                ethereum.on("accountsChanged", handleAccountsChanged);
                // Listen for chain changes
                ethereum.on("chainChanged", handleChainChanged);
                // Cleanup
                return ({
                    "WalletProvider.useEffect": ()=>{
                        ethereum.removeListener("accountsChanged", handleAccountsChanged);
                        ethereum.removeListener("chainChanged", handleChainChanged);
                    }
                })["WalletProvider.useEffect"];
            }
        }
    }["WalletProvider.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WalletContext.Provider, {
        value: {
            account,
            isConnected: !!account,
            connect,
            disconnect,
            balance
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/wallet-context.tsx",
        lineNumber: 155,
        columnNumber: 5
    }, this);
}
_s(WalletProvider, "SbCNJPqaueo5D9Hh7fVeeikSWno=");
_c = WalletProvider;
function useWallet() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(WalletContext);
    if (!context) {
        throw new Error("useWallet must be used within WalletProvider");
    }
    return context;
}
_s1(useWallet, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
const getAccounts = async ()=>{
    if (!window.ethereum) return [];
    try {
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });
        return accounts;
    } catch (error) {
        console.error("Error getting accounts:", error);
        return [];
    }
};
const getEthersProvider = ()=>{
    const ethereum = window.ethereum;
    if (!ethereum) {
        throw new Error("Ethereum provider not found");
    }
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$ethers$2f$lib$2e$esm$2f$ethers$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__ethers$3e$__["ethers"].BrowserProvider(ethereum);
};
var _c;
__turbopack_context__.k.register(_c, "WalletProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/providers.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Providers",
    ()=>Providers
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$wallet$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/wallet-context.tsx [app-client] (ecmascript)");
"use client";
;
;
function Providers({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$wallet$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WalletProvider"], {
        children: children
    }, void 0, false, {
        fileName: "[project]/components/providers.tsx",
        lineNumber: 7,
        columnNumber: 10
    }, this);
}
_c = Providers;
var _c;
__turbopack_context__.k.register(_c, "Providers");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_4836dac1._.js.map