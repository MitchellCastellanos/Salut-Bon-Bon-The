// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ledgerLabel, StampProgress, stampMessage } from "../src/stamp-progress";

const render = (balance: number, lang: "fr" | "en" = "fr") => renderToStaticMarkup(<StampProgress balance={balance} lang={lang}/>);

describe("stamp-card progress bar", () => {
  it("exposes an accessible progressbar and 9 stamp slots plus the free-drink slot", () => {
    const html = render(4, "en");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="4"');
    expect(html).toContain('aria-valuemax="9"');
    expect(html).toContain("4 of 9 stamps");
    expect(html).toContain('style="width:44%"');
    expect((html.match(/<li/g) ?? []).length).toBe(10);
    expect((html.match(/<li class="on"/g) ?? []).length).toBe(4);
    expect(html).toContain("5 more drinks and your next one is free!");
  });
  it("announces the free drink when the card is full, and carries extra stamps over", () => {
    expect(render(9)).toContain("Votre boisson gratuite est prête");
    expect(render(9)).toContain("stamp ready");
    expect(render(12, "en")).toContain("3 stamps carried over");
    expect(render(18, "en")).toContain("2 free drinks are waiting");
  });
  it("explains an empty card and a card one drink away, in both languages", () => {
    expect(stampMessage(0, "fr")).toBe("Achetez 9 boissons, la 10e est gratuite.");
    expect(stampMessage(0, "en")).toBe("Buy 9 drinks, the 10th is free.");
    expect(stampMessage(8, "fr")).toBe("Encore 1 boisson et la prochaine est gratuite !");
    expect(stampMessage(8, "en")).toBe("1 more drink and your next one is free!");
  });
  it("never overflows the bar for out-of-range balances", () => {
    expect(render(500)).toContain('aria-valuenow="9"');
    expect(render(-3)).toContain('aria-valuenow="0"');
  });
  it("labels ledger entries in stamps", () => {
    expect(ledgerLabel("earn", "fr")).toBe("Tampons gagnés");
    expect(ledgerLabel("redeem", "en")).toBe("Free drink redeemed");
    expect(ledgerLabel("reverse", "en")).toBe("Stamps reversed (refund)");
  });
});
