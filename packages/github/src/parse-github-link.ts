/**
 * Returns true when GitHub's Link response header includes a rel="next" relation.
 */
export function linkHeaderHasNextPage(linkHeader: string | undefined): boolean {
  if (linkHeader === undefined || linkHeader.length === 0) {
    return false;
  }
  return /(?:^|,)\s*<[^>]+>\s*;\s*rel="next"/i.test(linkHeader);
}
