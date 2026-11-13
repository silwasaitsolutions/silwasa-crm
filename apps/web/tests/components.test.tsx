// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "../components/ui/data-table";
import { Pagination } from "../components/ui/pagination";
import { PermissionMatrix } from "../features/roles/permission-matrix";

afterEach(cleanup);

interface Row { id: string; name: string }
const columns: Column<Row>[] = [{ key: "name", header: "Name", cell: (r) => r.name }];
const empty = { title: "Nothing here", description: "Add something" };

describe("DataTable", () => {
  it("shows skeleton rows while loading", () => {
    render(<DataTable caption="t" columns={columns} rows={undefined} rowKey={(r) => r.id} isLoading empty={empty} skeletonRows={3} />);
    expect(screen.getAllByTestId("skeleton-row")).toHaveLength(3);
    expect(screen.queryByText("Nothing here")).toBeNull();
  });

  it("shows the empty state when there are no rows", () => {
    render(<DataTable caption="t" columns={columns} rows={[]} rowKey={(r) => r.id} empty={empty} />);
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });

  it("shows an error with a working retry button", () => {
    const retry = vi.fn();
    render(<DataTable caption="t" columns={columns} rows={undefined} rowKey={(r) => r.id} error={new Error("boom")} onRetry={retry} empty={empty} />);
    expect(screen.getByRole("alert").textContent).toContain("boom");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("renders rows", () => {
    render(<DataTable caption="Users" columns={columns} rows={[{ id: "1", name: "Ann" }, { id: "2", name: "Bob" }]} rowKey={(r) => r.id} empty={empty} />);
    expect(screen.getByText("Ann")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.queryByText("Nothing here")).toBeNull();
  });
});

describe("Pagination", () => {
  it("reports the visible range and disables edges", () => {
    const onPage = vi.fn();
    render(<Pagination pagination={{ page: 1, pageSize: 10, total: 25, totalPages: 3 }} onPage={onPage} />);
    expect(screen.getByText("Showing 1–10 of 25")).toBeTruthy();
    expect((screen.getByLabelText("Previous page") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it("handles empty results", () => {
    render(<Pagination pagination={{ page: 1, pageSize: 10, total: 0, totalPages: 0 }} onPage={() => {}} />);
    expect(screen.getByText("No results")).toBeTruthy();
    expect((screen.getByLabelText("Next page") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("PermissionMatrix", () => {
  const catalog = [
    { key: "pages:read", module: "pages" },
    { key: "pages:publish", module: "pages" },
    { key: "media:read", module: "media" },
  ];

  it("toggles single permissions and whole groups", () => {
    const onChange = vi.fn();
    render(<PermissionMatrix permissions={catalog} value={["pages:read"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Select all Pages permissions"));
    expect(onChange).toHaveBeenLastCalledWith(["pages:read", "pages:publish"]);
    fireEvent.click(screen.getAllByRole("checkbox")[3]!); // media:read
    expect(onChange).toHaveBeenLastCalledWith(["pages:read", "media:read"]);
  });

  it("is fully disabled when read-only", () => {
    render(<PermissionMatrix permissions={catalog} value={[]} onChange={() => {}} readOnly />);
    for (const box of screen.getAllByRole("checkbox")) expect((box as HTMLInputElement).disabled).toBe(true);
  });
});
