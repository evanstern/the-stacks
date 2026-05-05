// Command the-stacks is the entrypoint for The Stacks: a hierarchical
// knowledge system pairing a hand-curated wiki with a vector RAG store.
//
// See designs/the-stacks.md for the architectural contract.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/evanstern/the-stacks/internal/cli"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) < 2 {
		usage()
		return fmt.Errorf("missing subcommand")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	sub := os.Args[1]
	args := os.Args[2:]

	switch sub {
	case "pull":
		return cli.RunPull(ctx, args, os.Stdout, os.Stderr)
	case "-h", "--help", "help":
		usage()
		return nil
	default:
		usage()
		return fmt.Errorf("unknown subcommand %q", sub)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `the-stacks — hierarchical wiki + RAG over a corpus

usage:
  the-stacks <subcommand> [flags]

subcommands:
  pull    pull Polymarket markets + trades into a sqlite ledger

run "the-stacks <subcommand> -h" for subcommand flags`)
}
