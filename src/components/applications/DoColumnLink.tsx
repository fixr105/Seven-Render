import { doColumnHref } from '../../lib/doApproval';

export function DoColumnLink({ value }: { value: string }) {
  const href = doColumnHref(value);
  if (!href) return <span data-testid="do-column-empty">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-testid="do-column-view"
      className="text-sm font-medium text-sf-navy underline"
      onClick={(event) => event.stopPropagation()}
    >
      View DO
    </a>
  );
}
