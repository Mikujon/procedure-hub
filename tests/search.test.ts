import { describe, it, expect } from "vitest";
import { escapeMeiliFilterValue } from "@/lib/search";

/**
 * escapeMeiliFilterValue closes a real filter-injection bug found while
 * writing this test file: departmentId/type/tags in api/search/route.ts
 * come straight from request query params and were interpolated unescaped
 * into a MeiliSearch filter string (`tags = "${t}"`) — a value containing
 * a `"` could break out of the quoted literal and append arbitrary filter
 * syntax (e.g. widen or defeat the `status = PUBLISHED` clause), the same
 * class of bug as unescaped string-built SQL. See lib/search.ts's own
 * comment on the function for the full reasoning; filterVisibleProcedureHits
 * (tests/permissions-search-visibility.test.ts) is the independent,
 * defense-in-depth backstop for the same underlying risk.
 */
describe("escapeMeiliFilterValue", () => {
  it("leaves an ordinary value unchanged", () => {
    expect(escapeMeiliFilterValue("GDPR")).toBe("GDPR");
  });

  it("escapes a double quote so it can't close the filter's string literal early", () => {
    // Without escaping, a filter clause built as `tags = "${value}"` from
    // this input would become: tags = "" OR status = "DRAFT" — closing the
    // literal after an empty string and appending an arbitrary OR clause.
    const malicious = '" OR status = "DRAFT';
    const escaped = escapeMeiliFilterValue(malicious);
    expect(escaped).toBe('\\" OR status = \\"DRAFT');
    // Rebuilding the same clause the real code does must yield a filter
    // string with exactly one real (unescaped) pair of quotes — the pair
    // the code itself added — proving the attacker's quotes are all escaped.
    const rebuilt = `tags = "${escaped}"`;
    const unescapedQuoteCount = (rebuilt.match(/(?<!\\)"/g) ?? []).length;
    expect(unescapedQuoteCount).toBe(2);
  });

  it("escapes a literal backslash first, so a trailing backslash can't swallow the closing quote", () => {
    // If backslashes were left unescaped, a trailing `\` right before the
    // closing quote this code adds would escape *that* quote instead of
    // terminating the string, again breaking out of the literal.
    const malicious = 'x\\';
    const escaped = escapeMeiliFilterValue(malicious);
    expect(escaped).toBe('x\\\\');
    const rebuilt = `tags = "${escaped}"`;
    expect(rebuilt).toBe('tags = "x\\\\"');
  });

  it("escapes multiple quotes and backslashes together", () => {
    expect(escapeMeiliFilterValue('a"b\\c"d')).toBe('a\\"b\\\\c\\"d');
  });
});
