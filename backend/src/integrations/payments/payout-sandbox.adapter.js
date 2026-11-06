/**
 * Payout Sandbox Adapter
 *
 * Clearly marked sandbox boundary for vendor bank payouts and withdrawal disbursements.
 * Provides idempotent transfer initiation and status query simulations without executing
 * real production banking rail transfers.
 */

const logger = require("../../config/logger");

const PAYOUT_ADAPTER_MODES = Object.freeze({
  SANDBOX: "sandbox_adapter",
  PRODUCTION: "production", // Not active without verified bank API integration
});

class PayoutSandboxAdapter {
  constructor() {
    this.mode = PAYOUT_ADAPTER_MODES.SANDBOX;
  }

  /**
   * Simulates bank transfer dispatch for an approved payout.
   *
   * @param {Object} params
   * @param {string} params.payoutId
   * @param {number|string} params.amount
   * @param {string} params.currency
   * @param {Object} params.bankSnapshot
   * @param {string} [params.reference]
   * @returns {Promise<Object>}
   */
  async initiateTransfer({
    payoutId,
    amount,
    currency = "INR",
    bankSnapshot,
    reference = null,
  }) {
    logger.info(
      {
        mode: this.mode,
        payoutId,
        amount,
        currency,
        maskedAccount: bankSnapshot?.accountNumberMasked,
        ifscCode: bankSnapshot?.ifscCode,
      },
      "Initiating sandbox bank transfer (SANDBOX_BOUNDARY)"
    );

    // Simulation of deterministic sandbox behavior:
    // If bank account holder contains "FAIL_SIMULATION", simulate rejection
    if (
      bankSnapshot?.accountHolderName &&
      bankSnapshot.accountHolderName.toUpperCase().includes("FAIL_SIMULATION")
    ) {
      return {
        success: false,
        mode: this.mode,
        provider: "SANDBOX_MOCK",
        providerReference: `SANDBOX-FAIL-${Date.now()}-${payoutId.toString().slice(-4)}`,
        status: "failed",
        failureReason: "SIMULATED_DESTINATION_REJECTION: Account closed or invalid IFSC in sandbox",
        timestamp: new Date().toISOString(),
      };
    }

    const providerReference =
      reference || `SANDBOX-UTR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return {
      success: true,
      mode: this.mode,
      provider: "SANDBOX_MOCK",
      providerReference,
      status: "processing",
      destination: {
        bankName: bankSnapshot?.bankName,
        accountHolderName: bankSnapshot?.accountHolderName,
        accountNumberMasked: bankSnapshot?.accountNumberMasked,
        ifscCode: bankSnapshot?.ifscCode,
      },
      amount,
      currency,
      timestamp: new Date().toISOString(),
      note: "SIMULATED_DISBURSEMENT_NON_PRODUCTION",
    };
  }

  /**
   * Checks simulated transfer status
   */
  async checkTransferStatus({ payoutId, providerReference }) {
    logger.info(
      { mode: this.mode, payoutId, providerReference },
      "Checking sandbox transfer status (SANDBOX_BOUNDARY)"
    );

    return {
      mode: this.mode,
      provider: "SANDBOX_MOCK",
      providerReference,
      status: "paid",
      verifiedAt: new Date().toISOString(),
    };
  }
}

const payoutSandboxAdapter = new PayoutSandboxAdapter();

module.exports = payoutSandboxAdapter;
module.exports.PayoutSandboxAdapter = PayoutSandboxAdapter;
module.exports.PAYOUT_ADAPTER_MODES = PAYOUT_ADAPTER_MODES;
