//"use client";
import { NextUIProvider } from "@nextui-org/system";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ThemeProviderProps } from "next-themes/dist/types";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import router from "../routes/index";

export interface ProvidersProps {
  themeProps?: ThemeProviderProps;
}

export function Providers({ themeProps }: ProvidersProps) {
  return (
    <NextUIProvider>
      <NextThemesProvider
        defaultTheme='system'
        attribute='class'
        {...themeProps}
      >
        <Toaster position="top-right" richColors closeButton />
        <RouterProvider
          router={router}
          fallbackElement={
            <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
              <div className="w-24 h-24 p-3 rounded-3xl bg-content2 border border-divider shadow-xl flex items-center justify-center">
                <img src="/branding/logo-inventarya.png" alt="Inventarya" className="w-full h-full object-contain rounded-2xl" />
              </div>
              <h1 className="text-3xl font-black tracking-widest text-foreground uppercase">INVENTARYA</h1>
            </div>
          }
        />
      </NextThemesProvider>
    </NextUIProvider>
  );
}