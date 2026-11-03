"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExtractedMeasurement, VerificationFlag } from "@/lib/types";
import { AlertTriangle, Check, Pencil } from "lucide-react";

export function MeasurementTable({
  measurements,
  flags,
  onChange,
  onConfirm,
  confirmMode,
}: {
  measurements: ExtractedMeasurement[];
  flags?: VerificationFlag[];
  onChange?: (id: string, patch: Partial<ExtractedMeasurement>) => void;
  onConfirm?: (id: string) => void;
  confirmMode?: boolean;
}) {
  const flagById = new Map((flags ?? []).map((f) => [f.measurementId, f]));

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70" data-testid="measurement-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Sig figs</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Status</TableHead>
            {confirmMode && <TableHead className="w-36">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {measurements.map((m) => {
            const flag = flagById.get(m.id);
            const flagged = m.flagged || !!flag;
            return (
              <TableRow
                key={m.id}
                className={flagged && !m.userConfirmed ? "bg-amber-50/80" : undefined}
                data-testid={`measurement-row-${m.id}`}
              >
                <TableCell className="font-medium">{m.label}</TableCell>
                <TableCell>
                  {confirmMode && flagged && !m.userConfirmed ? (
                    <Input
                      className="h-8 w-28 font-mono"
                      type="number"
                      step="any"
                      value={m.value}
                      onChange={(e) =>
                        onChange?.(m.id, {
                          value: Number(e.target.value),
                          userEdited: true,
                        })
                      }
                    />
                  ) : (
                    <span className="font-mono">{m.value}</span>
                  )}
                </TableCell>
                <TableCell>
                  {confirmMode && flagged && !m.userConfirmed ? (
                    <Input
                      className="h-8 w-20 font-mono"
                      value={m.unit}
                      onChange={(e) =>
                        onChange?.(m.id, { unit: e.target.value, userEdited: true })
                      }
                    />
                  ) : (
                    <span className="font-mono text-muted-foreground">{m.unit}</span>
                  )}
                </TableCell>
                <TableCell className="font-mono">{m.significantFigures}</TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {(m.confidence * 100).toFixed(0)}%
                </TableCell>
                <TableCell>
                  {m.userConfirmed ? (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="size-3" /> Confirmed
                    </Badge>
                  ) : flagged ? (
                    <Badge variant="outline" className="gap-1 border-amber-500 text-amber-800">
                      <AlertTriangle className="size-3" /> Flagged
                    </Badge>
                  ) : (
                    <Badge variant="secondary">OK</Badge>
                  )}
                  {(m.flagReason || flag?.message) && (
                    <p className="mt-1 max-w-xs text-xs text-amber-800/90">
                      {m.flagReason || flag?.message}
                    </p>
                  )}
                </TableCell>
                {confirmMode && (
                  <TableCell>
                    {flagged && !m.userConfirmed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        data-testid={`confirm-${m.id}`}
                        onClick={() => onConfirm?.(m.id)}
                      >
                        <Pencil className="size-3" /> Confirm
                      </Button>
                    ) : null}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
