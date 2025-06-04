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
import { useAuditLog } from "@/hooks/useAuditLog"

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
  
  const { createAuditEvent } = useAuditLog('temp-session-id')

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0]
      if (file.type !== "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        setUploadError("Invalid file type. Please upload a PPTX file.")
        setUploadedFile(null)
        
        createAuditEvent('create', {
          action: 'file_upload_failed',
          error: 'Invalid file type',
          attemptedFile: file.name,
          fileType: file.type
        })
        return
      }
      setUploadError(null)
      setIsUploading(true)
      setUploadedFile({ file, progress: 0 })

      createAuditEvent('create', {
        action: 'file_upload_started',
        fileName: file.name,
        fileSize: file.size
      })

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
          
          createAuditEvent('create', {
            action: 'file_upload_completed',
            fileName: file.name,
            fileSize: file.size
          })
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
      
      createAuditEvent('create', {
        action: 'navigation',
        from: 'upload',
        to: 'configure',
        fileName: uploadedFile.file.name
      })
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
    
    createAuditEvent('create', {
      action: 'configuration_submitted',
      sessionName,
      sourceLanguage,
      targetLanguage
    })

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
      
      createAuditEvent('create', {
        action: 'session_created',
        newSessionId,
        sessionName,
        sourceLanguage,
        targetLanguage
      })

      setIsCreatingSession(false)
      setCurrentStep(STEPS.SUCCESS)
    } catch (error) {
      console.error("Error creating session:", error)
      setConfigError("Failed to create session. Please try again.")
      setIsCreatingSession(false)
      
      createAuditEvent('create', {
        action: 'session_creation_failed',
        error: 'Failed to create session',
        sessionName,
        sourceLanguage,
        targetLanguage
      })
    }
  }

  const handleViewSlides = () => {
    if (mockSessionId) {
      createAuditEvent('create', {
        action: 'navigation',
        from: 'success',
        to: 'editor',
        sessionId: mockSessionId,
        sessionName
      })
      
      onComplete(mockSessionId, sessionName)
      router.push(`/editor/${mockSessionId}`)
    }
  }

  const handleShareNow = () => {
    if (mockSessionId) {
      createAuditEvent('share', {
        action: 'share_initiated',
        sessionId: mockSessionId,
        sessionName
      })
      
      // Implement share logic or redirect to a share page
      alert(`Sharing session: ${sessionName} (ID: ${mockSessionId}) - (Sharing not implemented)`)
    }
  }

  const renderUploadStep = () => (
    <CardContent className="space-y-6">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className={`flex min-h-[250px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center 
          ${isUploading ? "border-primary/50 bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"}`}
        onClick={() => !isUploading && document.getElementById("file-upload")?.click()}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          {isUploading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Uploading...</h3>
                <p className="text-sm text-muted-foreground">
                  {uploadedFile?.file.name} ({Math.round(uploadedFile?.file.size / 1024)} KB)
                </p>
              </div>
            </>
          ) : uploadedFile && uploadedFile.progress === 100 ? (
            <>
              <CheckCircle className="h-10 w-10 text-primary" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Upload Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  {uploadedFile.file.name} ({Math.round(uploadedFile.file.size / 1024)} KB)
                </p>
              </div>
            </>
          ) : (
            <>
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Upload Your PowerPoint File</h3>
                <p className="text-sm text-muted-foreground">Drag and drop or click to select a .pptx file</p>
              </div>
            </>
          )}
        </div>

        {uploadedFile && uploadedFile.progress > 0 && uploadedFile.progress < 100 && (
          <div className="mt-4 w-full max-w-xs space-y-2">
            <Progress value={uploadedFile.progress} className="h-2 w-full" />
            <p className="text-xs text-right text-muted-foreground">{uploadedFile.progress}%</p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          id="file-upload"
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files)}
          disabled={isUploading}
        />
      </div>

      {uploadError && (
        <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          <XCircle className="mx-auto mb-1 h-5 w-5" />
          {uploadError}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleProceedToConfigure}
          disabled={!uploadedFile || uploadedFile.progress < 100}
          className="gap-2"
        >
          <span>Continue</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </CardContent>
  )

  const renderConfigureStep = () => (
    <CardContent className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="session-name">Translation Session Name</Label>
          <Input
            id="session-name"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="My PowerPoint Translation"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="source-language">Source Language</Label>
            <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
              <SelectTrigger id="source-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map((lang) => (
                  <SelectItem key={`source-${lang.value}`} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-language">Target Language</Label>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger id="target-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map((lang) => (
                  <SelectItem key={`target-${lang.value}`} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* File Details */}
        <div className="rounded-md bg-muted p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">{uploadedFile?.file.name}</p>
              <p className="text-sm text-muted-foreground">
                {uploadedFile ? `${Math.round(uploadedFile.file.size / 1024)} KB` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isParsing && (
        <div className="flex items-center justify-center gap-3 rounded-md bg-primary/10 p-4 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium">Analyzing PowerPoint structure...</span>
        </div>
      )}

      {isCreatingSession && (
        <div className="flex items-center justify-center gap-3 rounded-md bg-primary/10 p-4 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium">Creating translation session...</span>
        </div>
      )}

      {configError && (
        <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          {configError}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(STEPS.UPLOAD)}>
          Back
        </Button>
        <Button onClick={handleConfigureSubmit} disabled={isParsing || isCreatingSession}>
          Create Translation Session
        </Button>
      </div>
    </CardContent>
  )

  const renderSuccessStep = () => (
    <CardContent className="space-y-6">
      <div className="flex flex-col items-center justify-center space-y-4 py-6">
        <div className="rounded-full bg-green-100 p-3 text-green-600 dark:bg-green-900/20 dark:text-green-400">
          <CheckCircle className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-semibold">Translation Session Created!</h3>
        <p className="max-w-md text-center text-muted-foreground">
          Your PowerPoint presentation has been processed successfully. You can now start translating slides.
        </p>
      </div>

      {/* Slide Preview (placeholder) */}
      <div className="mx-auto aspect-video w-full max-w-md overflow-hidden rounded-lg border bg-muted">
        <div className="relative h-full w-full">
          <Image
            src="/placeholder.svg?height=720&width=1280"
            alt="First slide preview"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="rounded bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur-sm">
              Slide preview
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
        <Button onClick={handleViewSlides} className="w-full sm:w-auto">
          View Slides & Start Translating
        </Button>
        <Button onClick={handleShareNow} variant="outline" className="w-full sm:w-auto">
          Share Now
        </Button>
      </div>
    </CardContent>
  )

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Create New Translation Session</CardTitle>
        <CardDescription>
          Upload a PowerPoint presentation and configure your translation session
        </CardDescription>
      </CardHeader>

      {currentStep === STEPS.UPLOAD && renderUploadStep()}
      {currentStep === STEPS.CONFIGURE && renderConfigureStep()}
      {currentStep === STEPS.SUCCESS && renderSuccessStep()}

      <CardFooter className="flex items-center justify-between border-t px-6 py-4">
        <div className="flex space-x-1">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              currentStep >= STEPS.UPLOAD ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          ></div>
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              currentStep >= STEPS.CONFIGURE ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          ></div>
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              currentStep >= STEPS.SUCCESS ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          ></div>
        </div>
        <span className="text-sm text-muted-foreground">
          Step {currentStep} of {Object.keys(STEPS).length}
        </span>
      </CardFooter>
    </Card>
  )
}
