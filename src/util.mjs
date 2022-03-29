export function TimestampVerifier(caveat) {
    if (!caveat.includes("time <")) return false;
    let timestamp = parseInt(caveat.replace("time < ", ""));
    if (timestamp > Date.now()) return true;
    return false;
  }
    