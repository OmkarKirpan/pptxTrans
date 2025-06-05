import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, Check, Presentation, Languages, Clock, FileUp, FileDown, Code } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-background shadow-sm rounded-b-2xl sticky top-0 z-30">
        <div className="container flex items-center justify-between py-4 mx-auto max-w-7xl">
          <div className="flex items-center gap-2">
            <Presentation className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">PowerPoint Translator</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium hover:text-primary transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">
              How It Works
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-background to-muted/60 pt-20 pb-28 flex items-center justify-center min-h-[60vh]">
        <div className="container flex flex-col md:flex-row items-center justify-center gap-12 max-w-5xl mx-auto">
          <div className="flex-1 flex flex-col items-center md:items-start justify-center space-y-6 max-w-2xl text-center md:text-left">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Translate Presentations <span className="text-primary">Without Losing Formatting</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Our AI-powered platform preserves your slide designs while translating content into multiple languages, saving you hours of manual work.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-2 w-full sm:w-auto justify-center md:justify-start">
              <Link href="/dashboard/new-session">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Translating
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  See How It Works
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border border-muted bg-background">
              <Image 
                src="/placeholder.svg"
                alt="PowerPoint Translator in action"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28 bg-background">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Why Choose Our Translator
            </h2>
            <p className="mt-4 text-xl text-muted-foreground max-w-3xl mx-auto">
              Designed specifically for presentations, our platform offers features no general translator can match.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card className="shadow-lg border border-muted/60 bg-background/80">
              <CardHeader>
                <Languages className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Perfect Formatting</CardTitle>
                <CardDescription>
                  Preserves all your original slide formatting, layouts, and design elements.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Our specialized technology maintains the exact visual appearance of your slides while translating text content.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg border border-muted/60 bg-background/80">
              <CardHeader>
                <Clock className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Time Saving</CardTitle>
                <CardDescription>
                  Translate entire presentations in minutes instead of hours or days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Automate the tedious process of manually copying and pasting content between translation tools and slides.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg border border-muted/60 bg-background/80">
              <CardHeader>
                <Code className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Contextual Accuracy</CardTitle>
                <CardDescription>
                  AI-powered translation that understands presentation context.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Get more accurate translations that account for the business context and technical terminology in your slides.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28 bg-muted/30">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Simple Three-Step Process
            </h2>
            <p className="mt-4 text-xl text-muted-foreground max-w-3xl mx-auto">
              Our streamlined workflow makes translating presentations effortless.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <FileUp className="h-8 w-8" />
                </div>
                <span className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-background border text-sm font-bold">1</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Upload</h3>
              <p className="text-muted-foreground">
                Upload your PowerPoint file through our secure interface.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <Languages className="h-8 w-8" />
                </div>
                <span className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-background border text-sm font-bold">2</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Translate</h3>
              <p className="text-muted-foreground">
                Select target languages and start the automated translation process.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <FileDown className="h-8 w-8" />
                </div>
                <span className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-background border text-sm font-bold">3</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Download</h3>
              <p className="text-muted-foreground">
                Review and download your perfectly translated presentation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-gradient-to-r from-primary/90 to-blue-500/80 text-primary-foreground rounded-t-3xl shadow-2xl">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-6">
            Ready to Transform Your Presentations?
          </h2>
          <p className="text-xl mb-8 text-primary-foreground/80">
            Join thousands of professionals who save time and maintain quality with our PowerPoint translation tool.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Get Started Free
              </Button>
            </Link>
            <Link href="/dashboard/new-session">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground/20 hover:bg-primary-foreground/10 text-black">
                Try Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background shadow-inner rounded-t-2xl mt-12">
        <div className="container py-8 md:py-12 mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Presentation className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold">PowerPoint Translator</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Preserving design while breaking language barriers for presentations worldwide.
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-3">Product</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    How It Works
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-3">Company</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-3">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center mt-8 pt-8 border-t">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} PowerPoint Translator. All rights reserved.
            </p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="sr-only">Twitter</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-twitter"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="sr-only">LinkedIn</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-linkedin"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="sr-only">GitHub</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-github"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}