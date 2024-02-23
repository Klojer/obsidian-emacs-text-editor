.DEFAULT_GOAL := build
.PHONY: install build lint setup uninstall
SHELL = bash
INSTALL_DIR = ${OBSIDIAN_PLUGINS_DIR}/emacs-text-editor

setup:
	npm install

lint: setup
	eslint --fix main.ts

build: lint
	npm run build

install: build
	[[ ! -z $$OBSIDIAN_PLUGINS_DIR ]] || (echo "OBSIDIAN_PLUGINS_DIR env var not set"; false)
	[[ -d "${OBSIDIAN_PLUGINS_DIR}" ]] || (echo "OBSIDIAN_PLUGINS_DIR env var directory does not exit: ${OBSIDIAN_PLUGINS_DIR}")
	[[ -d "${INSTALL_DIR}" ]] || mkdir -p ${INSTALL_DIR}
	cp main.js manifest.json ${INSTALL_DIR}

uninstall:
	rm -rf ${INSTALL_DIR}
