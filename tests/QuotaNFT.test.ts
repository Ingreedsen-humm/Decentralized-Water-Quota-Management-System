import { describe, it, expect, beforeEach } from "vitest";

const ERR_NOT_AUTHORIZED = 100;
const ERR_QUOTA_NOT_FOUND = 101;
const ERR_INVALID_RECIPIENT = 102;
const ERR_INVALID_AMOUNT = 103;
const ERR_INVALID_BASIN = 104;
const ERR_INVALID_EXPIRATION = 105;
const ERR_QUOTA_LOCKED = 106;
const ERR_QUOTA_BURN_FAILED = 107;
const ERR_QUOTA_ALREADY_MINTED = 108;
const ERR_INVALID_OWNER = 109;
const ERR_QUOTA_FROZEN = 110;
const ERR_METADATA_NOT_SET = 111;
const ERR_ORACLE_NOT_AUTHORIZED = 112;
const ERR_INSUFFICIENT_QUOTA = 113;
const ERR_BURN_AMOUNT_EXCEEDS = 114;
const ERR_TRANSFER_LOCKED = 115;
const ERR_QUOTA_EXPIRED = 116;
const ERR_INVALID_NFT_ID = 117;
const ERR_MAX_QUOTA_REACHED = 118;
const ERR_INVALID_FRACTIONAL = 119;

interface QuotaMetadata {
  "basin-id": string;
  "amount-m3": bigint;
  "expiration-year": bigint;
  "issued-at": bigint;
  locked: boolean;
  transferable: boolean;
  burnable: boolean;
  "fractional-allowed": boolean;
}

interface QuotaUsage {
  "used-m3": bigint;
  "last-updated": bigint;
}

interface MockState {
  admin: string;
  oracle: string | null;
  nextQuotaId: bigint;
  basinMaxQuota: bigint;
  quotaFrozen: boolean;
  quotas: Map<bigint, string>;
  metadata: Map<bigint, QuotaMetadata>;
  usage: Map<bigint, QuotaUsage>;
  basinTotals: Map<string, bigint>;
}

class QuotaNFTMock {
  state: MockState = {
    admin: "ST1ADMIN",
    oracle: null,
    nextQuotaId: 1n,
    basinMaxQuota: 1000000000n,
    quotaFrozen: false,
    quotas: new Map(),
    metadata: new Map(),
    usage: new Map(),
    basinTotals: new Map(),
  };
  blockHeight: bigint = 1000n;
  sender: string = "ST1ADMIN";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      admin: "ST1ADMIN",
      oracle: null,
      nextQuotaId: 1n,
      basinMaxQuota: 1000000000n,
      quotaFrozen: false,
      quotas: new Map(),
      metadata: new Map(),
      usage: new Map(),
      basinTotals: new Map(),
    };
    this.blockHeight = 1000n;
    this.sender = "ST1ADMIN";
  }

  isAdmin(): boolean {
    return this.sender === this.state.admin;
  }

  isOracle(): boolean {
    return this.state.oracle !== null && this.sender === this.state.oracle;
  }

  setAdmin(newAdmin: string): { ok: boolean; value: boolean } {
    if (!this.isAdmin()) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  setOracle(newOracle: string): { ok: boolean; value: boolean } {
    if (!this.isAdmin()) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.oracle = newOracle;
    return { ok: true, value: true };
  }

  freezeAllQuotas(): { ok: boolean; value: boolean } {
    if (!this.isAdmin()) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.quotaFrozen = true;
    return { ok: true, value: true };
  }

  unfreezeAllQuotas(): { ok: boolean; value: boolean } {
    if (!this.isAdmin()) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.quotaFrozen = false;
    return { ok: true, value: true };
  }

  mintQuota(
    recipient: string,
    basin: string,
    amountM3: bigint,
    expirationYear: bigint,
    transferable: boolean,
    burnable: boolean,
    fractionalAllowed: boolean
  ): { ok: boolean; value: bigint | number } {
    if (!this.isAdmin()) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (recipient === this.sender) return { ok: false, value: ERR_INVALID_RECIPIENT };
    if (basin.length === 0 || basin.length > 50) return { ok: false, value: ERR_INVALID_BASIN };
    if (amountM3 <= 0n) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (expirationYear < 2025n) return { ok: false, value: ERR_INVALID_EXPIRATION };

    const currentTotal = this.state.basinTotals.get(basin) ?? 0n;
    if (currentTotal + amountM3 > this.state.basinMaxQuota) {
      return { ok: false, value: ERR_MAX_QUOTA_REACHED };
    }

    const quotaId = this.state.nextQuotaId;
    this.state.quotas.set(quotaId, recipient);
    this.state.metadata.set(quotaId, {
      "basin-id": basin,
      "amount-m3": amountM3,
      "expiration-year": expirationYear,
      "issued-at": this.blockHeight,
      locked: false,
      transferable,
      burnable,
      "fractional-allowed": fractionalAllowed,
    });
    this.state.usage.set(quotaId, { "used-m3": 0n, "last-updated": this.blockHeight });
    this.state.basinTotals.set(basin, currentTotal + amountM3);
    this.state.nextQuotaId += 1n;

    return { ok: true, value: quotaId };
  }

  getQuota(id: bigint): string | null {
    return this.state.quotas.get(id) ?? null;
  }

  getQuotaDetails(id: bigint): QuotaMetadata | null {
    return this.state.metadata.get(id) ?? null;
  }

  getQuotaUsage(id: bigint): QuotaUsage | null {
    return this.state.usage.get(id) ?? null;
  }

  transferQuota(id: bigint, recipient: string): { ok: boolean; value: boolean | number } {
    const owner = this.state.quotas.get(id);
    if (!owner) return { ok: false, value: ERR_QUOTA_NOT_FOUND };
    const metadata = this.state.metadata.get(id);
    if (!metadata) return { ok: false, value: ERR_METADATA_NOT_SET };
    if (this.state.quotaFrozen) return { ok: false, value: ERR_QUOTA_FROZEN };
    if (this.sender !== owner) return { ok: false, value: ERR_INVALID_OWNER };
    if (!metadata.transferable) return { ok: false, value: ERR_TRANSFER_LOCKED };
    if (metadata["expiration-year"] < this.blockHeight) return { ok: false, value: ERR_QUOTA_EXPIRED };

    this.state.quotas.set(id, recipient);
    return { ok: true, value: true };
  }

  burnQuota(id: bigint, amountM3: bigint): { ok: boolean; value: boolean | number } {
    const owner = this.state.quotas.get(id);
    if (!owner) return { ok: false, value: ERR_QUOTA_NOT_FOUND };
    const metadata = this.state.metadata.get(id);
    if (!metadata) return { ok: false, value: ERR_METADATA_NOT_SET };
    const usage = this.state.usage.get(id);
    if (!usage) return { ok: false, value: ERR_QUOTA_NOT_FOUND };
    if (this.sender !== owner) return { ok: false, value: ERR_INVALID_OWNER };
    if (!metadata.burnable) return { ok: false, value: ERR_QUOTA_BURN_FAILED };
    const available = metadata["amount-m3"] - usage["used-m3"];
    if (amountM3 > available) return { ok: false, value: ERR_BURN_AMOUNT_EXCEEDS };
    if (amountM3 <= 0n) return { ok: false, value: ERR_INVALID_AMOUNT };

    metadata["amount-m3"] -= amountM3;
    usage["used-m3"] += amountM3;
    usage["last-updated"] = this.blockHeight;
    return { ok: true, value: true };
  }

  reportUsage(quotaId: bigint, usedM3: bigint): { ok: boolean; value: boolean | number } {
    if (!this.isOracle() && !this.isAdmin()) return { ok: false, value: ERR_ORACLE_NOT_AUTHORIZED };
    const metadata = this.state.metadata.get(quotaId);
    if (!metadata) return { ok: false, value: ERR_METADATA_NOT_SET };
    const usage = this.state.usage.get(quotaId) ?? { "used-m3": 0n, "last-updated": 0n };
    if (usage["used-m3"] + usedM3 > metadata["amount-m3"]) {
      return { ok: false, value: ERR_INSUFFICIENT_QUOTA };
    }
    usage["used-m3"] += usedM3;
    usage["last-updated"] = this.blockHeight;
    this.state.usage.set(quotaId, usage);
    return { ok: true, value: true };
  }

  lockQuota(id: bigint): { ok: boolean; value: boolean | number } {
    const owner = this.state.quotas.get(id);
    if (!owner) return { ok: false, value: ERR_QUOTA_NOT_FOUND };
    const metadata = this.state.metadata.get(id);
    if (!metadata) return { ok: false, value: ERR_METADATA_NOT_SET };
    if (!this.isAdmin() && this.sender !== owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    metadata.locked = true;
    return { ok: true, value: true };
  }

  unlockQuota(id: bigint): { ok: boolean; value: boolean | number } {
    const owner = this.state.quotas.get(id);
    if (!owner) return { ok: false, value: ERR_QUOTA_NOT_FOUND };
    const metadata = this.state.metadata.get(id);
    if (!metadata) return { ok: false, value: ERR_METADATA_NOT_SET };
    if (!this.isAdmin() && this.sender !== owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    metadata.locked = false;
    return { ok: true, value: true };
  }

  splitQuota(id: bigint, amountM3: bigint, recipient: string): { ok: boolean; value: bigint | number } {
    const owner = this.state.quotas.get(id);
    if (!owner) return { ok: false, value: ERR_QUOTA_NOT_FOUND };
    const metadata = this.state.metadata.get(id);
    if (!metadata) return { ok: false, value: ERR_METADATA_NOT_SET };
    if (this.sender !== owner) return { ok: false, value: ERR_INVALID_OWNER };
    if (!metadata["fractional-allowed"]) return { ok: false, value: ERR_INVALID_FRACTIONAL };
    if (amountM3 <= 0n) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (amountM3 >= metadata["amount-m3"]) return { ok: false, value: ERR_INSUFFICIENT_QUOTA };

    const newId = this.state.nextQuotaId;
    metadata["amount-m3"] -= amountM3;

    this.state.quotas.set(newId, recipient);
    this.state.metadata.set(newId, {
      "basin-id": metadata["basin-id"],
      "amount-m3": amountM3,
      "expiration-year": metadata["expiration-year"],
      "issued-at": this.blockHeight,
      locked: false,
      transferable: metadata.transferable,
      burnable: metadata.burnable,
      "fractional-allowed": metadata["fractional-allowed"],
    });
    this.state.usage.set(newId, { "used-m3": 0n, "last-updated": this.blockHeight });
    this.state.nextQuotaId += 1n;

    return { ok: true, value: newId };
  }

  getNextQuotaId(): { ok: boolean; value: bigint } {
    return { ok: true, value: this.state.nextQuotaId };
  }

  isQuotaExpired(id: bigint): { ok: boolean; value: boolean | number } {
    const metadata = this.state.metadata.get(id);
    if (!metadata) return { ok: false, value: ERR_QUOTA_NOT_FOUND };
    return { ok: true, value: metadata["expiration-year"] < this.blockHeight };
  }
}

describe("QuotaNFT Core Contract", () => {
  let mock: QuotaNFTMock;

  beforeEach(() => {
    mock = new QuotaNFTMock();
    mock.reset();
  });

  it("mints a new water quota successfully", () => {
    const result = mock.mintQuota(
      "ST2FARMER",
      "MerinLagoon",
      5000n,
      2030n,
      true,
      true,
      true
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1n);

    const owner = mock.getQuota(1n);
    expect(owner).toBe("ST2FARMER");

    const details = mock.getQuotaDetails(1n);
    expect(details?.["basin-id"]).toBe("MerinLagoon");
    expect(details?.["amount-m3"]).toBe(5000n);
    expect(details?.["expiration-year"]).toBe(2030n);
    expect(details?.transferable).toBe(true);
    expect(details?.burnable).toBe(true);
    expect(details?.["fractional-allowed"]).toBe(true);
  });

  it("rejects mint with invalid basin name", () => {
    const result = mock.mintQuota(
      "ST2FARMER",
      "",
      5000n,
      2030n,
      true,
      true,
      true
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BASIN);
  });

  it("rejects mint with zero amount", () => {
    const result = mock.mintQuota(
      "ST2FARMER",
      "MerinLagoon",
      0n,
      2030n,
      true,
      true,
      true
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("rejects mint with past expiration", () => {
    const result = mock.mintQuota(
      "ST2FARMER",
      "MerinLagoon",
      5000n,
      2020n,
      true,
      true,
      true
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_EXPIRATION);
  });

  it("rejects mint exceeding basin max", () => {
    mock.state.basinMaxQuota = 10000n;
    const result = mock.mintQuota(
      "ST2FARMER",
      "MerinLagoon",
      1000000001n,
      2030n,
      true,
      true,
      true
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_QUOTA_REACHED);
  });

  it("transfers quota to another farmer", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    mock.sender = "ST2FARMER";
    const result = mock.transferQuota(1n, "ST3BUYER");
    expect(result.ok).toBe(true);

    const newOwner = mock.getQuota(1n);
    expect(newOwner).toBe("ST3BUYER");
  });

  it("rejects transfer of non-transferable quota", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, false, true, true);
    mock.sender = "ST2FARMER";
    const result = mock.transferQuota(1n, "ST3BUYER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_TRANSFER_LOCKED);
  });

  it("rejects transfer by non-owner", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    mock.sender = "ST3HACKER";
    const result = mock.transferQuota(1n, "ST3BUYER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_OWNER);
  });

  it("rejects transfer when quotas are frozen", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    mock.freezeAllQuotas();
    mock.sender = "ST2FARMER";
    const result = mock.transferQuota(1n, "ST3BUYER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_QUOTA_FROZEN);
  });

  it("burns quota amount successfully", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    mock.sender = "ST2FARMER";
    const result = mock.burnQuota(1n, 1000n);
    expect(result.ok).toBe(true);

    const details = mock.getQuotaDetails(1n);
    expect(details?.["amount-m3"]).toBe(4000n);

    const usage = mock.getQuotaUsage(1n);
    expect(usage?.["used-m3"]).toBe(1000n);
  });

  it("rejects burn of non-burnable quota", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, false, true);
    mock.sender = "ST2FARMER";
    const result = mock.burnQuota(1n, 1000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_QUOTA_BURN_FAILED);
  });

  it("oracle reports usage correctly", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    mock.setOracle("ST1ORACLE");
    mock.sender = "ST1ORACLE";
    const result = mock.reportUsage(1n, 3000n);
    expect(result.ok).toBe(true);

    const usage = mock.getQuotaUsage(1n);
    expect(usage?.["used-m3"]).toBe(3000n);
  });

  it("rejects usage report from non-oracle", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    mock.sender = "ST3HACKER";
    const result = mock.reportUsage(1n, 3000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ORACLE_NOT_AUTHORIZED);
  });

  it("splits quota into two NFTs", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    mock.sender = "ST2FARMER";
    const result = mock.splitQuota(1n, 2000n, "ST3BUYER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2n);

    const orig = mock.getQuotaDetails(1n);
    expect(orig?.["amount-m3"]).toBe(3000n);

    const split = mock.getQuotaDetails(2n);
    expect(split?.["amount-m3"]).toBe(2000n);
    expect(split?.["basin-id"]).toBe("MerinLagoon");
  });

  it("rejects split of non-fractional quota", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, false);
    mock.sender = "ST2FARMER";
    const result = mock.splitQuota(1n, 2000n, "ST3BUYER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_FRACTIONAL);
  });

  it("locks and unlocks quota", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    mock.sender = "ST2FARMER";
    mock.lockQuota(1n);
    const locked = mock.getQuotaDetails(1n);
    expect(locked?.locked).toBe(true);

    mock.unlockQuota(1n);
    const unlocked = mock.getQuotaDetails(1n);
    expect(unlocked?.locked).toBe(false);
  });

  it("admin can lock any quota", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    mock.sender = "ST1ADMIN";
    const result = mock.lockQuota(1n);
    expect(result.ok).toBe(true);
  });

  it("returns correct next quota ID", () => {
    mock.mintQuota("ST2FARMER", "MerinLagoon", 5000n, 2030n, true, true, true);
    const result = mock.getNextQuotaId();
    expect(result.value).toBe(2n);
  });
});
