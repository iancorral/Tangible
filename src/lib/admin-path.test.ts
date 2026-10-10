import { describe, expect, it } from "vitest";
import { adminBaseFor, adminHref, isAdminHost } from "./admin-path";

describe("admin-path", () => {
  it("reconoce el subdominio admin", () => {
    expect(isAdminHost("admin.studiotangible.com.mx")).toBe(true);
    expect(isAdminHost("ADMIN.localhost:3000")).toBe(true);
    expect(isAdminHost("www.studiotangible.com.mx")).toBe(false);
    expect(isAdminHost("192.168.1.72:3000")).toBe(false);
    expect(isAdminHost(null)).toBe(false);
  });

  it("arma enlaces limpios en el subdominio y con /admin en otro host", () => {
    expect(adminHref(adminBaseFor("admin.studiotangible.com.mx"), "/calendar")).toBe("/calendar");
    expect(adminHref(adminBaseFor("admin.studiotangible.com.mx"), "/")).toBe("/");
    expect(adminHref(adminBaseFor("localhost:3000"), "/calendar")).toBe("/admin/calendar");
    expect(adminHref(adminBaseFor("localhost:3000"), "/")).toBe("/admin");
  });
});
