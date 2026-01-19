import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap } from "lucide-react";

/**
 * Auth Page - Clerk Authentication
 *
 * Uses Clerk's pre-built SignIn and SignUp components.
 * Redirects to home if already authenticated.
 */
export default function Auth() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/");
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">SEO Content Ops Suite</h1>
          <p className="text-muted-foreground text-sm">
            Content Engine • Elementor Export • Analytics
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">Anmelden</TabsTrigger>
            <TabsTrigger value="register">Registrieren</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="flex justify-center">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border rounded-lg",
                },
              }}
              routing="hash"
              signUpUrl="#register"
              afterSignInUrl="/"
            />
          </TabsContent>

          <TabsContent value="register" className="flex justify-center">
            <SignUp
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border rounded-lg",
                },
              }}
              routing="hash"
              signInUrl="#login"
              afterSignUpUrl="/"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
