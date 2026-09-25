"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/auth.store.js";

/**
 * Production Google Sign-In Button Component
 *
 * Implements Google Identity Services (GIS) ID-token authentication:
 * 1. Safely loads and initializes GIS (window.google.accounts.id)
 * 2. Renders Google's official responsive pill-shaped button via renderButton
 * 3. Gracefully handles user interaction, loading states, popups, and cancellations
 * 4. Dispatches verified ID token to backend POST /api/v1/auth/google via useAuthStore
 * 5. Strictly protects against SSR hydration issues, duplicate initializations, and race conditions
 */
export function GoogleSignInButton({
  textType = "continue_with", // "continue_with" | "signup_with" | "signin_with"
  onSuccess,
  onError,
  isParentSubmitting = false,
  className = "",
}) {
  const containerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);

  const [isScriptReady, setIsScriptReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasRenderedGoogleButton, setHasRenderedGoogleButton] = useState(false);

  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();

  /**
   * Handle credential response from Google Identity Services
   */
  const handleCredentialResponse = useCallback(
    async (response) => {
      if (!response?.credential) {
        const errorMsg = "Google Sign-In was cancelled or failed to provide a credential.";
        if (onError) onError(errorMsg);
        else toast.error(errorMsg);
        return;
      }

      setIsAuthenticating(true);
      if (onError) onError("");

      try {
        await loginWithGoogle({ idToken: response.credential });
        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Google authentication was unsuccessful. Please try again.";
        if (onError) {
          onError(message);
        } else {
          toast.error(message);
        }
      } finally {
        setIsAuthenticating(false);
      }
    },
    [loginWithGoogle, onSuccess, onError]
  );

  /**
   * Ensure Google Identity Services script is loaded
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.google?.accounts?.id) {
      setIsScriptReady(true);
      return;
    }

    // Check if script tag already exists in DOM
    const SCRIPT_ID = "google-identity-services-script";
    let scriptTag = document.getElementById(SCRIPT_ID);

    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.id = SCRIPT_ID;
      scriptTag.src = "https://accounts.google.com/gsi/client";
      scriptTag.async = true;
      scriptTag.defer = true;
      document.head.appendChild(scriptTag);
    }

    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        setIsScriptReady(true);
        clearInterval(checkInterval);
      }
    }, 50);

    const onScriptLoad = () => {
      if (window.google?.accounts?.id) {
        setIsScriptReady(true);
        clearInterval(checkInterval);
      }
    };

    scriptTag.addEventListener("load", onScriptLoad);

    return () => {
      clearInterval(checkInterval);
      scriptTag.removeEventListener("load", onScriptLoad);
    };
  }, []);

  /**
   * Initialize Google Identity Services and render button
   */
  useEffect(() => {
    if (!isScriptReady || typeof window === "undefined" || !window.google?.accounts?.id) {
      return;
    }

    if (!clientId) {
      // Configuration is missing
      return;
    }

    if (!containerRef.current) {
      return;
    }

    if (isInitializedRef.current) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Calculate container width (constrained to Google limits: 200px - 400px)
      const containerWidth = containerRef.current.offsetWidth || 384;
      const targetWidth = Math.min(Math.max(containerWidth, 200), 400);

      // Render the official Google Identity Services button
      containerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: textType,
        shape: "pill",
        logo_alignment: "left",
        width: targetWidth,
      });

      isInitializedRef.current = true;
      setHasRenderedGoogleButton(true);
    } catch (err) {
      console.warn("Failed to render Google Identity Services button:", err);
    }
  }, [isScriptReady, clientId, textType, handleCredentialResponse]);

  /**
   * Fallback button click handler (when rendered button isn't loaded or client ID is missing)
   */
  const handleFallbackClick = () => {
    if (!clientId) {
      const msg = "Google Sign-In is not configured. Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID.";
      if (onError) onError(msg);
      else toast.error(msg);
      return;
    }

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            toast.info("Google Sign-In", {
              description: "Please click the Google button directly to select an account.",
            });
          }
        });
      } catch {
        toast.info("Opening Google Sign-In...");
      }
    } else {
      toast.info("Loading Google Sign-In...", {
        description: "Connecting to Google authentication service. Please try again in a second.",
      });
    }
  };

  const isBusy = isAuthenticating || isParentSubmitting;

  return (
    <div className={`w-full flex flex-col items-center justify-center ${className}`}>
      {/* 1. Loading State */}
      {isBusy && (
        <button
          type="button"
          disabled
          aria-label="Signing in with Google"
          className="w-full rounded-full border border-slate-200 bg-slate-50 text-slate-500 font-bold text-xs py-3 shadow-xs flex items-center justify-center gap-3 cursor-not-allowed"
        >
          <Loader2 className="size-4 animate-spin text-[#007A55]" />
          Signing in with Google...
        </button>
      )}

      {/* 2. Official Google Rendered Button Container */}
      <div
        ref={containerRef}
        className={`w-full flex justify-center items-center overflow-hidden min-h-[44px] ${
          isBusy ? "hidden" : hasRenderedGoogleButton ? "block" : "hidden"
        }`}
        style={{ minHeight: "44px" }}
      />

      {/* 3. Fallback Button (visible while GIS script loads or if client ID unconfigured) */}
      {!isBusy && !hasRenderedGoogleButton && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={isBusy}
          data-testid="google-fallback-button"
          className="w-full rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-3 shadow-xs active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          {textType === "signup_with" ? "Sign up with Google" : "Continue with Google"}
        </button>
      )}
    </div>
  );
}

export default GoogleSignInButton;
