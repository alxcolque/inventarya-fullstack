/** Only same-origin absolute paths; reject encoded URL/control bypasses too. */
export const isSafeInternalRoute = (route?: unknown): route is string => {
  if (typeof route !== 'string' || route.length > 2048 || route !== route.trim()) return false;
  try {
    let decoded = route;
    for (let count = 0; count < 3; count++) {
      const unsafeCharacter = Array.from(decoded).some((character) =>
        character === '\\' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
      if (!decoded.startsWith('/') || decoded.startsWith('//') || unsafeCharacter || decoded.includes('://')) return false;
      const next = decodeURIComponent(decoded);
      if (next === decoded) return true;
      decoded = next;
    }
    return false;
  } catch { return false; }
};
