import { useEffect } from "react";

export const useEmbedScriptLoader = (embedToken: string | undefined | null) => {
  useEffect(() => {
    if (!embedToken) return;

    const script = document.createElement("script");
    script.id = "viasocket-embed-main-script";
    script.src = "https://embed.viasocket.com/prod-embedcomponent.js";
    script.setAttribute("embedToken", embedToken);
    script.setAttribute("parentId", "alert-embed-parent");
    script.setAttribute("configurationJson", JSON.stringify({})); // Add auth/config if needed
    
    document.body.appendChild(script);

    return () => {
      // Clean up script
      const scriptEl = document.getElementById("viasocket-embed-main-script");
      if (scriptEl) scriptEl.remove();
      
      // Clean up embed iframe container
      const container = document.getElementById("iframe-viasocket-embed-parent-container");
      if (container) container.remove();
    };
  }, [embedToken]);
};

// Ensure window.openViasocket exists in typescript
declare global {
  interface Window {
    openViasocket?: (scriptId: string | undefined, options: any) => void;
  }
}
