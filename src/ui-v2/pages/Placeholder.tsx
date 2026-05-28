import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pantalla pendiente de diseño.
        </CardContent>
      </Card>
    </div>
  );
}
