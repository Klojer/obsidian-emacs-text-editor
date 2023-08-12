TARGET_DIR_PATH = ${OBSIDIAN_PLUGINS_DIR}/emacs-text-editor

lint:
	eslint main.ts

build: lint
	npm run build

install: build
	mkdir -p ${TARGET_DIR_PATH}
	cp main.js manifest.json ${TARGET_DIR_PATH}

uninstall:
	rm -rf ${TARGET_DIR_PATH}
