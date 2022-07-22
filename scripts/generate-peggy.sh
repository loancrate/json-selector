#!/bin/sh

set -e

mkdir -p src/__generated__

peggy -o src/__generated__/parser.js src/grammar.pegjs
