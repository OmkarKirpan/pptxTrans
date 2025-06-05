"use client"

import { useState, useCallback, useRef, type ChangeEvent, type DragEvent, useEffect } from "react"
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
import { useTranslationSessions } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { PptxProcessorClient } from "@/lib/api/pptx-processor"
import * as tus from "tus-js-client"
import { CreateSessionPayload } from "@/types/api"

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
  const supabase = createClient()
  const pptxProcessor = new PptxProcessorClient()
  const uploadCancelRef = useRef<boolean>(false)
  const tusUploadRef = useRef<tus.Upload | null>(null)
  
  const [currentStep, setCurrentStep] = useState<WizardStep>(STEPS.UPLOAD)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isProcessingSubmittedConfig, setIsProcessingSubmittedConfig] = useState(false)

  const [sessionName, setSessionName] = useState("")
  const [sourceLanguage, setSourceLanguage] = useState<string>("en")
  const [targetLanguage, setTargetLanguage] = useState<string>("es")

  const [uploadError, setUploadError] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  
  // Use the translation sessions slice
  const { createSession, isCreating: isTranslationSessionCreating, error: translationSessionCreationError } = useTranslationSessions()
  
  // Create a temporary session ID for audit logging
  const tempSessionId = sessionId || 'temp-session-id'
  const { createAuditEvent } = useAuditLog(tempSessionId)

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
      uploadCancelRef.current = false
      setUploadedFile({ file, progress: 0 })

      createAuditEvent('create', {
        action: 'file_upload_started',
        fileName: file.name,
        fileSize: file.size
      })
    }
  }

  // Upload file to Supabase Storage using resumable uploads (TUS protocol)
  const uploadFileToSupabase = async (file: File) => {
    try {
      // Generate a unique filename to prevent collisions
      const timestamp = new Date().getTime()
      const fileExtension = file.name.split('.').pop()
      const uniqueFilename = `${timestamp}_${file.name}`
      const filePath = `uploads/${userId}/${uniqueFilename}`
      
      // Get the current session for auth
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Authentication required')
      }
      
      return new Promise<{ path: string; publicUrl: string }>((resolve, reject) => {
        // Create a new tus upload
        tusUploadRef.current = new tus.Upload(file, {
          // The endpoint for resumable uploads
          endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'}/storage/v1/upload/resumable`,
          // Retry delays on failure
          retryDelays: [0, 3000, 5000, 10000, 20000],
          // Auth headers
          headers: {
            authorization: `Bearer ${session.access_token}`,
            'x-upsert': 'true', // Overwrite if file exists
          },
          // Upload data during creation request
          uploadDataDuringCreation: true,
          // Remove fingerprint when upload completes
          removeFingerprintOnSuccess: true,
          // Metadata for the file
          metadata: {
            bucketName: 'pptx-files',
            objectName: filePath,
            contentType: file.type,
            cacheControl: '3600',
          },
          // Use 6MB chunks (required by Supabase Storage)
          chunkSize: 6 * 1024 * 1024,
          // Error handler
          onError: (error) => {
            console.error('Upload failed:', error)
            setUploadError(`Upload failed: ${error.message || 'Unknown error'}`)
            setIsUploading(false)
            
            createAuditEvent('create', {
              action: 'file_upload_failed',
              fileName: file.name,
              fileSize: file.size,
              error: error.message || 'Unknown error'
            })
            
            reject(error)
          },
          // Progress handler
          onProgress: (bytesUploaded, bytesTotal) => {
            if (uploadCancelRef.current) return
            
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100)
            setUploadedFile((prev) => (prev ? { ...prev, progress: percentage } : null))
          },
          // Success handler
          onSuccess: () => {
            console.log('Upload completed successfully')
            
            // Get the public URL
            const publicUrl = supabase.storage
              .from('pptx-files')
              .getPublicUrl(filePath)
            
            createAuditEvent('create', {
              action: 'file_upload_completed',
              fileName: file.name,
              fileSize: file.size,
              filePath,
              publicUrl: publicUrl.data.publicUrl
            })
            
            resolve({
              path: filePath,
              publicUrl: publicUrl.data.publicUrl
            })
          }
        })
        
        // Check for previous uploads to resume
        tusUploadRef.current.findPreviousUploads().then((previousUploads) => {
          // If there are previous uploads, resume from the first one
          if (previousUploads.length) {
            tusUploadRef.current!.resumeFromPreviousUpload(previousUploads[0])
          }
          
          // Start the upload
          tusUploadRef.current!.start()
        })
      })
    } catch (error) {
      console.error('Error in uploadFileToSupabase:', error)
      createAuditEvent('create', {
        action: 'file_upload_failed',
        fileName: file.name,
        fileSize: file.size,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  // Cancel upload if in progress
  const cancelUpload = () => {
    if (tusUploadRef.current && isUploading) {
      uploadCancelRef.current = true
      tusUploadRef.current.abort()
      setIsUploading(false)
      setUploadedFile(null)
      
      createAuditEvent('create', {
        action: 'file_upload_cancelled',
        fileName: uploadedFile?.file.name,
        fileSize: uploadedFile?.file.size
      })
    }
  }

  // Handle file upload
  useEffect(() => {
    const uploadFile = async () => {
      if (uploadedFile && isUploading && uploadedFile.progress === 0) {
        try {
          const result = await uploadFileToSupabase(uploadedFile.file)
          
          // Update uploadedFile with storage path
          setUploadedFile((prev) => 
            prev ? { ...prev, progress: 100, storagePath: result.path, publicUrl: result.publicUrl } : null
          )
          setIsUploading(false)
        } catch (error) {
          setUploadError(`Upload failed: ${error instanceof Error ? error.message : String(error)}`)
          setIsUploading(false)
          setUploadedFile((prev) => (prev ? { ...prev, error: String(error) } : null))
        }
      }
    }
    
    uploadFile()
  }, [uploadedFile, isUploading])

  // Clean up upload when component unmounts
  useEffect(() => {
    return () => {
      if (tusUploadRef.current && isUploading) {
        uploadCancelRef.current = true
        tusUploadRef.current.abort()
      }
    }
  }, [isUploading])

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
    if (!uploadedFile || !uploadedFile.storagePath || !sessionName || !sourceLanguage || !targetLanguage) {
      setConfigError("Please fill in all required fields (file seems to be missing stored path).")
      createAuditEvent('create', { 
        action: 'session_configuration_failed', 
        error: 'Missing fields or file storage path',
        sessionNameAttempt: sessionName,
        sourceLanguage,
        targetLanguage,
        originalFileName: uploadedFile?.file.name
      });
      return
    }
    setConfigError(null)
    setIsProcessingSubmittedConfig(true)

    createAuditEvent('create', { 
      action: 'session_configuration_submitted', 
      sessionName,
      sourceLanguage,
      targetLanguage,
      originalFileName: uploadedFile.file.name,
      filePath: uploadedFile.storagePath
    });

    try {
      const payload: CreateSessionPayload = {
        session_name: sessionName,
        original_file_name: uploadedFile.file.name,
        source_language_code: sourceLanguage,
        target_language_codes: [targetLanguage],
      }

      const newSession = await createSession(payload)

      if (newSession && newSession.id) {
        setSessionId(newSession.id)

        createAuditEvent('create', {
          action: 'translation_session_created',
          sessionId: newSession.id,
          sessionName: newSession.session_name
        });

        const processResponse = await pptxProcessor.processPptx(
          uploadedFile.file,
          newSession.id,
          sourceLanguage,
          targetLanguage,
          true
        );

        if (processResponse.job_id) {
          setJobId(processResponse.job_id)
          createAuditEvent('create', {
            action: 'pptx_processing_started',
            sessionId: newSession.id,
            jobId: processResponse.job_id
          });
          setCurrentStep(STEPS.SUCCESS)
          onComplete(newSession.id, newSession.session_name)
        } else {
          throw new Error(processResponse.error || "Failed to start PPTX processing job.")
        }
      } else {
        setConfigError(translationSessionCreationError || "Failed to create session record. Please try again.")
        createAuditEvent('create', { 
          action: 'translation_session_creation_failed', 
          error: translationSessionCreationError || 'Unknown error from createSession',
          sessionNameAttempt: sessionName,
        });
      }
    } catch (err: any) {
      console.error("Configuration or processing error:", err)
      setConfigError(err.message || "An unexpected error occurred during configuration or processing.")
      createAuditEvent('create', { 
        action: 'session_configuration_or_processing_error', 
        error: err.message || 'Unknown error',
        sessionNameAttempt: sessionName,
      });
    } finally {
      setIsProcessingSubmittedConfig(false)
    }
  }

  const handleViewSlides = () => {
    if (sessionId) {
      createAuditEvent('create', {
        action: 'navigation',
        from: 'success',
        to: 'editor',
        sessionId: sessionId,
        sessionName
      })
      
      onComplete(sessionId, sessionName)
      router.push(`/editor/${sessionId}`)
    }
  }

  const handleShareNow = () => {
    if (sessionId) {
      createAuditEvent('share', {
        action: 'share_initiated',
        sessionId: sessionId,
        sessionName
      })
      
      // TODO: Implement sharing logic
      router.push(`/dashboard/share/${sessionId}`) // This route would need to be created
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
                  {uploadedFile?.file.name} ({Math.round(uploadedFile?.file.size || 0) / 1024} KB)
                </p>
              </div>
            </>
          ) : uploadedFile && uploadedFile.progress === 100 ? (
            <>
              <CheckCircle className="h-10 w-10 text-primary" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Upload Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  {uploadedFile.file.name} ({Math.round(uploadedFile.file.size || 0) / 1024} KB)
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

      <div className="flex justify-between">
        {isUploading && (
          <Button variant="outline" onClick={cancelUpload}>
            Cancel Upload
          </Button>
        )}
        <div className="ml-auto">
          <Button
            onClick={handleProceedToConfigure}
            disabled={!uploadedFile || uploadedFile.progress < 100}
            className="gap-2"
          >
            <span>Continue</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
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
                {uploadedFile ? `${Math.round(uploadedFile.file.size || 0) / 1024} KB` : ""}
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
        <Button onClick={handleConfigureSubmit} disabled={isProcessingSubmittedConfig}>
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
