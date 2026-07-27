(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/components/theme-provider.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeProvider",
    ()=>ThemeProvider
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-themes/dist/index.mjs [app-client] (ecmascript)");
'use client';
;
;
function ThemeProvider({ children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ThemeProvider"], {
        ...props,
        children: children
    }, void 0, false, {
        fileName: "[project]/components/theme-provider.tsx",
        lineNumber: 10,
        columnNumber: 10
    }, this);
}
_c = ThemeProvider;
var _c;
__turbopack_context__.k.register(_c, "ThemeProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/store/auth.store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAuthStore",
    ()=>useAuthStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
"use client";
;
;
const useAuthStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])((set)=>({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        setAuth: ({ user, accessToken, refreshToken })=>set({
                user,
                accessToken,
                refreshToken: refreshToken || null,
                isAuthenticated: true
            }),
        logout: ()=>set({
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false
            })
    }), {
    name: "auth-storage"
}));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/shared/config/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "API_BASE_URL",
    ()=>API_BASE_URL
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
const envBackendUrl = ("TURBOPACK compile-time value", "http://localhost:3005")?.trim();
const API_BASE_URL = (envBackendUrl && envBackendUrl.length > 0 ? envBackendUrl : "/api" // fallback relativo para cuando no hay env configurado
).replace(/\/+$/, "");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/shared/components/AuthInterceptor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthInterceptor",
    ()=>AuthInterceptor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$store$2f$auth$2e$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/store/auth.store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$shared$2f$config$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/shared/config/api.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function AuthInterceptor() {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthInterceptor.useEffect": ()=>{
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const originalFetch = window.fetch;
            let isRefreshing = false;
            let refreshQueue = [];
            const processQueue = {
                "AuthInterceptor.useEffect.processQueue": (token)=>{
                    refreshQueue.forEach({
                        "AuthInterceptor.useEffect.processQueue": (callback)=>callback(token)
                    }["AuthInterceptor.useEffect.processQueue"]);
                    refreshQueue = [];
                }
            }["AuthInterceptor.useEffect.processQueue"];
            const rejectQueue = {
                "AuthInterceptor.useEffect.rejectQueue": ()=>{
                    refreshQueue = [];
                }
            }["AuthInterceptor.useEffect.rejectQueue"];
            window.fetch = ({
                "AuthInterceptor.useEffect": async (input, init)=>{
                    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
                    const isApiRequest = url.includes(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$shared$2f$config$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["API_BASE_URL"]);
                    const isRefreshRequest = url.includes("/auth/refresh");
                    const hasClientHeader = init?.headers && (init.headers instanceof Headers && init.headers.has("X-Client-Request") || Array.isArray(init.headers) && init.headers.some({
                        "AuthInterceptor.useEffect": ([k])=>k.toLowerCase() === "x-client-request"
                    }["AuthInterceptor.useEffect"]) || typeof init.headers === "object" && init.headers["X-Client-Request"]);
                    if (!isApiRequest || isRefreshRequest || hasClientHeader) {
                        return originalFetch(input, init);
                    }
                    // Intentar realizar la petición original
                    let response = await originalFetch(input, init);
                    // Si retorna 401, el token expiro. Intentar refrescar.
                    if (response.status === 401) {
                        const { refreshToken, setAuth, logout } = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$store$2f$auth$2e$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthStore"].getState();
                        if (!refreshToken) {
                            logout();
                            return response;
                        }
                        if (isRefreshing) {
                            return new Promise({
                                "AuthInterceptor.useEffect": (resolve)=>{
                                    refreshQueue.push({
                                        "AuthInterceptor.useEffect": (newToken)=>{
                                            const newInit = {
                                                ...init
                                            };
                                            const headers = new Headers(newInit.headers);
                                            headers.set("Authorization", `Bearer ${newToken}`);
                                            newInit.headers = headers;
                                            resolve(originalFetch(input, newInit));
                                        }
                                    }["AuthInterceptor.useEffect"]);
                                }
                            }["AuthInterceptor.useEffect"]);
                        }
                        isRefreshing = true;
                        try {
                            const refreshRes = await originalFetch(`${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$shared$2f$config$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["API_BASE_URL"]}/auth/refresh`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    refreshToken
                                })
                            });
                            if (refreshRes.ok) {
                                const data = await refreshRes.json();
                                setAuth({
                                    accessToken: data.accessToken,
                                    refreshToken: data.refreshToken,
                                    user: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$store$2f$auth$2e$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthStore"].getState().user
                                });
                                processQueue(data.accessToken);
                                const newInit = {
                                    ...init
                                };
                                const headers = new Headers(newInit.headers);
                                headers.set("Authorization", `Bearer ${data.accessToken}`);
                                newInit.headers = headers;
                                return originalFetch(input, newInit);
                            } else {
                                logout();
                                rejectQueue();
                                window.location.href = "/login";
                            }
                        } catch (err) {
                            logout();
                            rejectQueue();
                            window.location.href = "/login";
                        } finally{
                            isRefreshing = false;
                        }
                    }
                    return response;
                }
            })["AuthInterceptor.useEffect"];
            return ({
                "AuthInterceptor.useEffect": ()=>{
                    window.fetch = originalFetch;
                }
            })["AuthInterceptor.useEffect"];
        }
    }["AuthInterceptor.useEffect"], []);
    return null;
}
_s(AuthInterceptor, "OD7bBpZva5O2jO+Puf00hKivP7c=");
_c = AuthInterceptor;
var _c;
__turbopack_context__.k.register(_c, "AuthInterceptor");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_6462907b._.js.map