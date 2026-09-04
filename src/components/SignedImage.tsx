import React, { useEffect, useState } from "react";
import { resolveMediaUrl } from "../lib/storage";
import { supabase } from "../supabaseClient";

export function SignedImage({
  path,
  className = "",
  alt = "",
}: {
  path: string | null | undefined;
  className?: string;
  alt?: string;
}) {
  const [url, setUrl] = useState<string | null>(() => resolveMediaUrl(path));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    const direct = resolveMediaUrl(path);
    setUrl(direct);
  }, [path]);

  if (!path) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 text-xs ${className}`}>
        No image
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 text-xs ${className}`}>
        Image unavailable
      </div>
    );
  }

  if (!url) return <div className={`animate-pulse bg-gray-200 ${className}`} />;

  const handleImgError = () => {
    if (path && !path.startsWith("http://") && !path.startsWith("https://") && !path.startsWith("data:") && supabase) {
      const clean = path.startsWith("media/") ? path.slice(6) : path;
      const fallbackUrl = supabase.storage.from("media").getPublicUrl(clean).data.publicUrl;
      if (url !== fallbackUrl) {
        setUrl(fallbackUrl);
        return;
      }
    }
    setHasError(true);
  };

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={handleImgError}
    />
  );
}

export default SignedImage;
