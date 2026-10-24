/* eslint-disable */
/**
 * Language support smoke test: every sample file must be detected from its
 * extension and must actually be colourised in the editor.
 */
;(async () => {
  const report = { ok: [], failed: [], notes: [] }
  const api = window.api
  const store = window.opennotes.store
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const dir = 'I:/notepad/.lang-workspace'

  const samples = {
    'Main.java':
      'public class Main {\n  public static void main(String[] a) {\n    int x = 42;\n    System.out.println("hi");\n  }\n}\n',
    'server.go': 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi")\n}\n',
    'Program.cs':
      'using System;\n\nnamespace Demo {\n  class Program {\n    static void Main() {\n      Console.WriteLine("hi");\n    }\n  }\n}\n',
    'main.cpp': '#include <iostream>\n\nint main() {\n  std::cout << "hi" << std::endl;\n  return 0;\n}\n',
    'main.c': '#include <stdio.h>\n\nint main(void) {\n  printf("hi\\n");\n  return 0;\n}\n',
    'app.ts':
      'export interface User {\n  name: string\n}\n\nexport const greet = (u: User): string => `hi ${u.name}`\n',
    'app.tsx': 'export const App = () => <div className="x">hi</div>\n',
    'script.py': 'def greet(name: str) -> str:\n    """Say hi."""\n    return f"hi {name}"\n',
    'lib.rs': 'pub fn greet(name: &str) -> String {\n    format!("hi {}", name)\n}\n',
    'index.php': '<?php\nfunction greet($name) {\n  return "hi $name";\n}\n',
    'app.rb': 'def greet(name)\n  "hi #{name}"\nend\n',
    'App.swift': 'func greet(name: String) -> String {\n  return "hi \\(name)"\n}\n',
    'Main.kt': 'fun main() {\n  val name = "hi"\n  println(name)\n}\n',
    'App.scala': 'object Main {\n  def main(args: Array[String]): Unit = println("hi")\n}\n',
    'main.dart': 'void main() {\n  var name = "hi";\n  print(name);\n}\n',
    'main.m': '#import <Foundation/Foundation.h>\nint main() { NSLog(@"hi"); return 0; }\n',
    'app.js': 'export const greet = (name) => `hi ${name}`\n',
    'app.jsx': 'export const App = () => <div>hi</div>\n',
    'page.html': '<!doctype html>\n<html><body><p class="x">hi</p></body></html>\n',
    'style.css': '.card { color: #ff0000; margin: 0 auto; }\n',
    'style.scss': '$c: #ff0000;\n.card { color: $c; &:hover { color: blue; } }\n',
    'data.json': '{ "name": "hi", "count": 42, "ok": true }\n',
    'config.yaml': 'name: hi\ncount: 42\nlist:\n  - a\n',
    'config.toml': 'name = "hi"\ncount = 42\n',
    'app.ini': '[main]\nname=hi\n',
    'query.sql': 'SELECT id, name FROM users WHERE id = 42;\n',
    'run.sh': '#!/bin/bash\nname="hi"\necho "$name"\n',
    'run.ps1': '$name = "hi"\nWrite-Host $name\n',
    'run.bat': '@echo off\nset name=hi\necho %name%\n',
    'main.lua': 'local function greet(name) return "hi " .. name end\n',
    'main.pl': 'sub greet { my $name = shift; return "hi $name"; }\n',
    'main.r': 'greet <- function(name) paste0("hi ", name) }\n',
    'main.jl': 'greet(name) = "hi $name"\n',
    'main.hs': 'greet :: String -> String\ngreet name = "hi " ++ name\n',
    'main.ex': 'defmodule Main do\n  def greet(name), do: "hi #{name}"\nend\n',
    'main.erl': 'greet(Name) -> "hi " ++ Name.\n',
    'main.ml': 'let greet name = "hi " ^ name\n',
    'Program.fs': 'let greet name = "hi " + name\n',
    'Program.vb': 'Public Sub Main()\n    Console.WriteLine("hi")\nEnd Sub\n',
    'main.zig': 'const std = @import("std");\npub fn main() void {}\n',
    'main.nim': 'proc greet(name: string): string = "hi " & name\n',
    'main.pas': "program Hello;\nbegin\n  writeln('hi');\nend.\n",
    'main.f90': 'program main\n  print *, "hi"\nend program\n',
    'main.cob': 'IDENTIFICATION DIVISION.\nPROGRAM-ID. HELLO.\n',
    'main.sol': 'contract Token {\n  function total() external view returns (uint256);\n}\n',
    'main.v': 'module top;\n  initial begin $display("hi"); end\n',
    'main.vhd': 'entity hello is\nend entity;\n',
    'App.vue': '<template><div>hi</div></template>\n<script setup>const x = 1</script>\n',
    'App.svelte': '<script>let x = 1</script>\n<div>hi</div>\n',
    'query.graphql': 'query { user(id: 42) { name } }\n',
    'main.tf': 'resource "aws_instance" "web" {\n  ami = "ami-42"\n}\n',
    Dockerfile: 'FROM alpine:3.20\nRUN apk add --no-cache nodejs\n',
    'nginx.conf': 'server {\n  listen 80;\n  server_name localhost;\n}\n',
    Makefile: 'all:\n\t@echo building\n',
    'notes.tex': '\\documentclass{article}\n\\begin{document}hi\\end{document}\n',
    'old.diff': '--- a\n+++ b\n-old\n+new\n',
    'app.log': '2026-01-01 info: hi\n',
    'data.csv': 'name,value\nhi,42\n',
    'player.gd':
      'extends Node\n\nclass_name Player\n\n@export var speed: float = 100.0\n\nfunc _ready() -> void:\n\tprint("ready")\n',
    'build.gradle':
      'plugins {\n  id "com.android.application"\n}\n\ndependencies {\n  implementation "org.jetbrains.kotlin:kotlin-stdlib"\n}\n',
    'build.gradle.kts': 'plugins {\n  kotlin("jvm") version "1.9"\n}\n',
    'Main.elm': 'module Main exposing (..)\n\ngreet : String -> String\ngreet name = "hi " ++ name\n',
    'app.purs': 'module Main where\n\nimport Prelude\n\ngreet :: String -> String\ngreet name = "hi " <> name\n',
    'Main.hx': 'class Main {\n  static function main() {\n    trace("hi");\n  }\n}\n',
    'Main.idr': 'module Main\n\ntotal : Nat\ntotal = 42\n',
    'Lemma.agda': 'module Lemma where\n\nopen import Data.Nat\n\nlemma : (n : Nat) -> n + 0 == n\nlemma zero = refl\n',
    'Proof.lean':
      'theorem addZero (n : Nat) : n + 0 = n := by\n  induction n with\n  | zero => rfl\n  | succ k ih => simp [ih]\n',
    'hello.raku': 'sub greet($name) {\n  "hi $name"\n}\n',
    'api.http': 'GET /users HTTP/1.1\nHost: example.com\nAuthorization: Bearer token\nAccept: application/json\n',
    'index.rst': 'Title\n=====\n\nSection\n-------\n\n.. code-block:: python\n\n   print("hi")\n',
    'schema.prisma': 'model User {\n  id    Int    @id\n  email String @unique\n}\n',
    'app.service': '[Unit]\nDescription=My service\n\n[Service]\nExecStart=/usr/bin/app\n',
    'app.desktop': '[Desktop Entry]\nType=Application\nName=My App\nExec=/usr/bin/myapp\n',
    gitconfig: '[core]\n\trepositoryformatversion = 0\n[user]\n\tname = Open Notes\n',
    '.gitignore': '# build\nnode_modules/\n*.log\n!important.log\n',
    '.editorconfig': 'root = true\n\n[*]\nindent_style = space\nindent_size = 2\n',
    'page.mustache': '<h1>{{title}}</h1>\n{{#items}}<li>{{name}}</li>{{/items}}\n',
    'page.hbs': '<h1>{{title}}</h1>\n{{#each items}}<li>{{this}}</li>{{/each}}\n',
    'page.ejs': '<h1><%= title %></h1>\n<% items.forEach(function (i) { %>\n<li><%= i %></li>\n<% }) %>\n',
    'page.pug': 'extends layout\n\nblock content\n  h1 Hello\n  each item in items\n    li= item\n',
    'page.twig': '{% for item in items %}\n<li>{{ item }}</li>\n{% endfor %}\n',
    'page.liquid': '{% if user %}\n{{ user.name }}\n{% endif %}\n',
    'login.feature':
      'Feature: Login\n\n  Scenario: Valid user\n    Given I am on the login page\n    When I enter valid credentials\n    Then I see the dashboard\n',
    'suite.robot':
      '*** Settings ***\nLibrary    SeleniumLibrary\n\n*** Test Cases ***\nOpen Page\n    Go To    https://example.com\n',
    'config.jsonnet': 'local base = { port: 8080 };\n{\n  app: base + { name: "demo" },\n}\n',
    'schema.cue': 'package demo\n\napp: {\n\tport: 8080\n\tname: "demo"\n}\n',
    'build.star': 'def main():\n    print("hi")\n',
    justfile: 'set dotenv-load\n\nbuild:\n    @echo building\n',
    'meson.build': "project('demo', 'c')\nexecutable('demo', 'main.c')\n",
    'CMakeLists.txt':
      'cmake_minimum_required(VERSION 3.16)\nproject(demo LANGUAGES CXX)\nadd_executable(demo main.cpp)\n',
    'build.ninja': 'rule cc\n  command = c++ $in -o $out\n\nbuild demo: cc main.cpp\n',
    'BUILD.bazel': 'cc_library(name = "demo", srcs = ["main.cpp"])\n',
    'module.wat':
      '(module\n  (func (export "add") (param i32 i32) (result i32)\n    local.get 0\n    local.get 1\n    i32.add))\n',
    'part.scad': 'module part() {\n  difference() {\n    cylinder(r = 5, h = 10);\n  }\n}\n',
    'sketch.ino': 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n}\n',
    'main.rkt': '#lang racket\n(define (greet name) (string-append "hi " name))\n',
    'init.scm': '(define (greet name) (string-append "hi " name))\n',
    'init.el': '(defun greet (name) (message "hi " name))\n',
    'Info.plist':
      '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n<key>CFBundleName</key>\n<string>Demo</string>\n</dict>\n</plist>\n',
    'Localizable.strings': '"welcome" = "Hi";\n"goodbye" = "Bye";\n',
    'App.xcconfig': 'PRODUCT_BUNDLE_IDENTIFIER = com.demo.app\nSWIFT_VERSION = 5.9\n',
    'demo.sln': 'Microsoft Visual Studio Solution File, Format Version 12.00\nProject("{X}") = "demo", "demo.csproj"\n',
    'demo.csproj':
      '<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n  </PropertyGroup>\n</Project>\n',
    'Scene.tscn': '[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Script" path="player.gd" id="1"]\n',
    'data.tres': '[gd_resource type="Texture2D" format=3]\n[resource]\ntexture = ExtResource("1")\n',
  }

  for (const [name, content] of Object.entries(samples)) {
    await api.fs.writeTextFile(dir + '/' + name, content)
  }

  let checked = 0
  for (const name of Object.keys(samples)) {
    await store.getState().openPath(dir + '/' + name)
    await wait(600)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('/' + name))
    const content = document.querySelector('.cm-content')
    const coloured = content
      ? Array.from(content.querySelectorAll('span')).filter((s) => {
          const colour = getComputedStyle(s).color
          return colour && colour !== 'rgb(205, 214, 244)'
        }).length
      : 0
    checked++
    if (!tab || tab.language === 'text' || tab.language === '?') {
      report.failed.push(name + ' :: not detected (language=' + (tab ? tab.language : '?') + ')')
    } else if (coloured === 0) {
      report.failed.push(name + ' :: no highlighting (language=' + tab.language + ')')
    } else {
      report.ok.push(name + ' (' + tab.language + ')')
    }
  }

  report.notes.push('checked ' + checked + ' files, ' + report.ok.length + ' with highlighting')
  return JSON.stringify(report)
})()
