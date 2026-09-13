.PHONY: sync pin-grammar-tag verify-sync test-highlights check

sync:
	./scripts/sync-tree-sitter-queries.sh

pin-grammar-tag:
	test -n "$(TAG)"
	./scripts/pin-grammar-tag.sh "$(TAG)"

verify-sync:
	./scripts/verify-tree-sitter-queries.sh

test-highlights:
	node scripts/check-highlights.mjs

check:
	cargo check
	$(MAKE) verify-sync
	$(MAKE) test-highlights
