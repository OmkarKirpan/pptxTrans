package main

import (
	"fmt"
	"os"
	"os/exec"
)

func main() {
	// This file exists only to fix the "no Go files in directory" error
	// The actual main function is in cmd/server/main.go
	fmt.Println("Starting audit-service...")

	cmd := exec.Command("go", "run", "cmd/server/main.go")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
