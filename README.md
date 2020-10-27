# BFCache Form Element Fix ![CI](https://github.com/stefanpenner/bfcache-form-element-fix/workflows/CI/badge.svg)

BFCache in chrome (as of <???>) may update form elements state without
emitting the corresponding change events, this can lead to broken form logic.

This repo aims to provide both a reproduction, and a a possible workaround.

## Usage:

## Steps to reproduce:
