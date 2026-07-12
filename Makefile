# game-merge-101 — build/run management
#
# Common targets:
#   make install   install npm dependencies
#   make dev       run the Vite dev server (hot reload)
#   make build     produce an optimized production bundle in dist/
#   make preview   serve the production build locally
#   make clean     remove build output
#   make distclean remove build output AND node_modules

NPM ?= npm

.PHONY: all install dev build preview clean distclean

all: build

# node_modules is the install marker so `make dev`/`make build` only install once.
node_modules: package.json
	$(NPM) install
	@touch node_modules

install: node_modules

dev: node_modules
	$(NPM) run dev

build: node_modules
	$(NPM) run build

preview: build
	$(NPM) run preview

clean:
	rm -rf dist

distclean: clean
	rm -rf node_modules
