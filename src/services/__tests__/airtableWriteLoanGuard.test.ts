
import { describe, expect, it } from "vitest";
import { airtableWrite, EngineRequestError } from "../engineClient";

describe("airtableWrite Loan Applications guard", () => {
  it("rejects create without rec… record_id", async () => {
    await expect(
      airtableWrite({
        table: "Loan Applications",
        fields: { "Form Data": "{}" },
      })
    ).rejects.toBeInstanceOf(EngineRequestError);
  });
});
