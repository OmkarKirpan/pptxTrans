"use client"

import { useState, useCallback, type ChangeEvent, type DragEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UploadedFile } from "@/types"
import { UploadCloud, FileText, CheckCircle, XCircle, ArrowRight, Loader2 } from "lucide-react"
import Image from "next/image"

interface UploadWizardProps {
  onComplete: (sessionId: string, sessionName: string) => void
  supportedLanguages: Array<{ value: string; label: string }>
  userId: string // Needed for creating session
}

const STEPS = {
  UPLOAD: 1,
  CONFIGURE: 2,
  SUCCESS: 3,
} as const

type WizardStep = (typeof STEPS)[keyof typeof STEPS]

export default function UploadWizard({ onComplete, supportedLanguages, userId }: UploadWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<WizardStep>(STEPS.UPLOAD)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  const [sessionName, setSessionName] = useState("")
  const [sourceLanguage, setSourceLanguage] = useState<string>("")
  const [targetLanguage, setTargetLanguage] = useState<string>("")

  const [uploadError, setUploadError] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const [mockSessionId, setMockSessionId] = useState<string | null>(null)

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0]
      if (file.type !== "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        setUploadError("Invalid file type. Please upload a PPTX file.")
        setUploadedFile(null)
        return
      }
      setUploadError(null)
      setIsUploading(true)
      setUploadedFile({ file, progress: 0 })

      // Mock upload progress
      let progress = 0
      const interval = setInterval(() => {
        progress += 10
        if (progress <= 100) {
          setUploadedFile((prev) => (prev ? { ...prev, progress } : null))
        } else {
          clearInterval(interval)
          setIsUploading(false)
          setUploadedFile((prev) => (prev ? { ...prev, progress: 100 } : null))
        }
      }, 200)
    }
  }

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    handleFileChange(event.dataTransfer.files)
  }, [])

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleProceedToConfigure = () => {
    if (uploadedFile && uploadedFile.progress === 100) {
      setSessionName(uploadedFile.file.name.replace(/\.pptx$/i, ""))
      setCurrentStep(STEPS.CONFIGURE)
    }
  }

  const handleConfigureSubmit = async () => {
    if (!sessionName.trim()) {
      setConfigError("Session name is required.")
      return
    }
    if (!sourceLanguage || !targetLanguage) {
      setConfigError("Source and target languages are required.")
      return
    }
    if (sourceLanguage === targetLanguage) {
      setConfigError("Source and target languages cannot be the same.")
      return
    }
    setConfigError(null)
    setIsParsing(true)

    // Mock parsing progress
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsParsing(false)
    setIsCreatingSession(true)

    // Mock session creation (replace with actual Supabase call)
    try {
      // const { data, error } = await supabase.from('translation_sessions').insert({ ... }).select();
      await new Promise((resolve) => setTimeout(resolve, 1500)) // Simulate API
      const newSessionId = `sess_${Date.now()}` // Mock ID
      setMockSessionId(newSessionId)

      setIsCreatingSession(false)
      setCurrentStep(STEPS.SUCCESS)
    } catch (error) {
      console.error("Error creating session:", error)
      setConfigError("Failed to create session. Please try again.")
      setIsCreatingSession(false)
    }
  }

  const handleViewSlides = () => {
    if (mockSessionId) {
      onComplete(mockSessionId, sessionName)
      router.push(`/editor/${mockSessionId}`)
    }
  }

  const handleShareNow = () => {
    if (mockSessionId) {
      // Implement share logic or redirect to a share page
      alert(`Sharing session: ${sessionName} (ID: ${mockSessionId}) - (Sharing not implemented)`)
    }
  }

  const renderUploadStep = () => (
    <CardContent className="space-y-6">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/10"
      >
        <UploadCloud className="mb-4 h-16 w-16 text-primary/70" />
        <p className="mb-2 text-lg font-semibold text-foreground">Drag & drop your PPTX file here</p>
        <p className="text-sm text-muted-foreground">or click to browse</p>
        <Input
          type="file"
          className="sr-only"
          id="file-upload"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFileChange(e.target.files)}
        />
        <Label htmlFor="file-upload" className="mt-4 cursor-pointer text-sm text-primary hover:underline">
          Browse files
        </Label>
      </div>
      {uploadError && (
        <div className="flex items-center space-x-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{uploadError}</span>
        </div>
      )}
      {uploadedFile && (
        <div className="space-y-2 rounded-md border bg-card p-4 shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{uploadedFile.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(uploadedFile.file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            {uploadedFile.progress === 100 && !isUploading && <CheckCircle className="h-6 w-6 text-success" />}
            {isUploading && uploadedFile.progress < 100 && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
          </div>
          <Progress value={uploadedFile.progress} className="h-2" />
          {uploadedFile.progress === 100 && !isUploading && (
            <p className="text-center text-xs text-success-foreground">Upload complete!</p>
          )}
        </div>
      )}
    </CardContent>
  )

  const renderConfigureStep = () => (
    <CardContent className="space-y-6">
      <div>
        <Label htmlFor="sessionName">Session Name</Label>
        <Input
          id="sessionName"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="e.g., Q3 Marketing Pitch"
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="sourceLanguage">Source Language</Label>
          <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
            <SelectTrigger id="sourceLanguage" className="mt-1 w-full">
              <SelectValue placeholder="Select source language" />
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="targetLanguage">Target Language</Label>
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger id="targetLanguage" className="mt-1 w-full">
              <SelectValue placeholder="Select target language" />
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isParsing && (
        <div className="flex flex-col items-center space-y-2 pt-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Parsing slides and extracting text...</p>
          {/* You could add a mock progress bar here too */}
        </div>
      )}
      {configError && (
        <div className="flex items-center space-x-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{configError}</span>
        </div>
      )}
    </CardContent>
  )

  const renderSuccessStep = () => (
    <CardContent className="flex flex-col items-center text-center">
      <CheckCircle className="mb-6 h-20 w-20 text-success" />
      <h2 className="mb-2 text-2xl font-semibold">Session Created!</h2>
      <p className="mb-1 text-muted-foreground">
        Your presentation <span className="font-medium text-foreground">"{sessionName}"</span> is ready for translation.
      </p>
      <p className="mb-6 text-sm text-muted-foreground">(Mock Session ID: {mockSessionId})</p>
      <div className="mt-4 w-full max-w-xs rounded-md border bg-card p-4 shadow">
        <p className="mb-2 text-sm font-medium text-foreground">Preview of First Slide:</p>
        <div className="aspect-video w-full bg-muted">
          <Image
            src={`/placeholder.svg?height=180&width=320&query=slide+preview+${sessionName}`}
            alt="First slide preview"
            width={320}
            height={180}
            className="rounded"
          />
        </div>
      </div>
    </CardContent>
  )

  const stepTitles: Record<WizardStep, string> = {
    [STEPS.UPLOAD]: "Upload Presentation",
    [STEPS.CONFIGURE]: "Configure Session",
    [STEPS.SUCCESS]: "Session Ready",
  }

  const stepDescriptions: Record<WizardStep, string> = {
    [STEPS.UPLOAD]: "Select or drag your .pptx file to begin.",
    [STEPS.CONFIGURE]: "Name your session and select languages.",
    [STEPS.SUCCESS]: "Your translation session has been successfully set up.",
  }

  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">{stepTitles[currentStep]}</CardTitle>
        <CardDescription>{stepDescriptions[currentStep]}</CardDescription>
      </CardHeader>

      {currentStep === STEPS.UPLOAD && renderUploadStep()}
      {currentStep === STEPS.CONFIGURE && renderConfigureStep()}
      {currentStep === STEPS.SUCCESS && renderSuccessStep()}

      <CardFooter className="flex justify-end space-x-3 border-t pt-6">
        {currentStep === STEPS.UPLOAD && (
          <Button
            onClick={handleProceedToConfigure}
            disabled={!uploadedFile || uploadedFile.progress < 100 || isUploading}
          >
            Next: Configure <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        {currentStep === STEPS.CONFIGURE && (
          <>
            <Button
              variant="outline"
              onClick={() => setCurrentStep(STEPS.UPLOAD)}
              disabled={isParsing || isCreatingSession}
            >
              Back to Upload
            </Button>
            <Button onClick={handleConfigureSubmit} disabled={isParsing || isCreatingSession}>
              {(isParsing || isCreatingSession) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingSession ? "Creating Session..." : isParsing ? "Parsing..." : "Create Session"}
            </Button>
          </>
        )}
        {currentStep === STEPS.SUCCESS && (
          <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleShareNow}>
              Share Now
            </Button>
            <Button onClick={handleViewSlides}>
              Start Translating <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
