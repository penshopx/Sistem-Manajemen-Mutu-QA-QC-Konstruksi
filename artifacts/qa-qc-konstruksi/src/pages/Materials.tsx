import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMaterialTypes,
  useCreateMaterialType,
  useListMaterialLocations,
  useCreateMaterialLocation,
  useListMaterialBatches,
  useCreateMaterialBatch,
  useGetMaterialBatchTrace,
  useGetMaterialBatchRecall,
  usePlaceMaterialInventory,
  useRecordMaterialUsage,
  getListMaterialTypesQueryKey,
  getListMaterialLocationsQueryKey,
  getListMaterialBatchesQueryKey,
  getGetMaterialBatchTraceQueryKey,
  getGetMaterialBatchRecallQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal } from "@/components/ui/core";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MapPin, Box, Plus, History, AlertTriangle, ShieldCheck, Database, Layers } from "lucide-react";
import { format } from "date-fns";

export function MaterialsPage() {
  const [activeTab, setActiveTab] = useState("batches");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Modal States
  const [isCreateBatchModalOpen, setIsCreateBatchModalOpen] = useState(false);
  const [isCreateTypeModalOpen, setIsCreateTypeModalOpen] = useState(false);
  const [isCreateLocModalOpen, setIsCreateLocModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  
  // Data Fetching
  const { data: batches = [], isLoading: isLoadingBatches, isError: isErrorBatches } = useListMaterialBatches();
  const { data: locations = [], isLoading: isLoadingLocs, isError: isErrorLocs } = useListMaterialLocations();
  const { data: types = [], isLoading: isLoadingTypes, isError: isErrorTypes } = useListMaterialTypes();
  
  // Tracing Fetching
  const { data: traceData, isLoading: isLoadingTrace, isError: isErrorTrace } = useGetMaterialBatchTrace(selectedBatchId || "", {
    query: {
      enabled: !!selectedBatchId,
      queryKey: getGetMaterialBatchTraceQueryKey(selectedBatchId || ""),
    }
  });
  
  const { data: recallData, isLoading: isLoadingRecall, isError: isErrorRecall } = useGetMaterialBatchRecall(selectedBatchId || "", {
    query: {
      enabled: !!selectedBatchId,
      queryKey: getGetMaterialBatchRecallQueryKey(selectedBatchId || ""),
    }
  });

  const filteredBatches = batches.filter(b => 
    b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display uppercase tracking-tight">Material Traceability</h1>
          <p className="text-muted-foreground text-sm">Kelola master data dan lacak material dari gudang hingga pemasangan</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="batches">Material Batches</TabsTrigger>
          <TabsTrigger value="master">Master Data</TabsTrigger>
          <TabsTrigger value="trace" disabled={!selectedBatchId}>Batch Trace</TabsTrigger>
          <TabsTrigger value="recall" disabled={!selectedBatchId}>Impact Analysis</TabsTrigger>
        </TabsList>
        
        {/* TAB: BATCHES */}
        <TabsContent value="batches" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
              <CardTitle>Daftar Pengiriman Material</CardTitle>
              <div className="flex items-center gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Cari no. batch, supplier..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button onClick={() => setIsCreateBatchModalOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Batch Baru
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50 font-mono">
                    <TableRow>
                      <TableHead>Batch No</TableHead>
                      <TableHead>Tipe Material</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Tgl Kedatangan</TableHead>
                      <TableHead>Kuantitas</TableHead>
                      <TableHead>Status QA</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingBatches ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8">Memuat data...</TableCell></TableRow>
                    ) : isErrorBatches ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-destructive">Gagal memuat data material batch.</TableCell></TableRow>
                    ) : filteredBatches.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada data batch material.</TableCell></TableRow>
                    ) : (
                      filteredBatches.map(batch => {
                        const typeName = types.find(t => t.id === batch.materialTypeId)?.name || 'Unknown Type';
                        return (
                          <TableRow key={batch.id} className={selectedBatchId === batch.id ? "bg-primary/5" : ""}>
                            <TableCell className="font-mono text-primary font-bold">
                              {batch.batchNumber}
                            </TableCell>
                            <TableCell className="font-medium">{typeName}</TableCell>
                            <TableCell>{batch.supplier}</TableCell>
                            <TableCell>{format(new Date(batch.deliveryDate), "dd MMM yyyy")}</TableCell>
                            <TableCell>{batch.quantity} {batch.unit}</TableCell>
                            <TableCell>
                              <Badge variant={
                                batch.inspectionStatus === "approved" ? "success" : 
                                batch.inspectionStatus === "rejected" ? "destructive" : "warning"
                              }>
                                {batch.inspectionStatus.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedBatchId(batch.id);
                                    setActiveTab("trace");
                                  }}
                                >
                                  <History className="w-4 h-4 mr-1" /> Lacak
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-destructive hover:bg-destructive hover:text-white border-destructive/20"
                                  onClick={() => {
                                    setSelectedBatchId(batch.id);
                                    setActiveTab("recall");
                                  }}
                                >
                                  <AlertTriangle className="w-4 h-4 mr-1" /> Impact
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: MASTER DATA */}
        <TabsContent value="master" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Master Material Types */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" /> Master Material
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setIsCreateTypeModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Tambah
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50 font-mono text-xs">
                    <TableRow>
                      <TableHead>Nama Material</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Satuan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingTypes ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6">Memuat...</TableCell></TableRow>
                    ) : isErrorTypes ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-destructive">Gagal memuat master material.</TableCell></TableRow>
                    ) : types.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Belum ada data master material.</TableCell></TableRow>
                    ) : (
                      types.map(t => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell><Badge variant="secondary" className="font-mono text-[10px]">{t.category}</Badge></TableCell>
                          <TableCell>{t.unit}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Master Storage Locations */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" /> Lokasi Penyimpanan
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setIsCreateLocModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Tambah
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50 font-mono text-xs">
                    <TableRow>
                      <TableHead>Nama Lokasi</TableHead>
                      <TableHead>Deskripsi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingLocs ? (
                      <TableRow><TableCell colSpan={2} className="text-center py-6">Memuat...</TableCell></TableRow>
                    ) : isErrorLocs ? (
                      <TableRow><TableCell colSpan={2} className="text-center py-6 text-destructive">Gagal memuat lokasi penyimpanan.</TableCell></TableRow>
                    ) : locations.length === 0 ? (
                      <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground">Belum ada data lokasi.</TableCell></TableRow>
                    ) : (
                      locations.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{l.description || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: BATCH TRACE */}
        <TabsContent value="trace" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => setActiveTab("batches")}>Kembali</Button>
            {traceData && (
              <span className="font-mono text-sm text-muted-foreground">
                Menampilkan jejak untuk Batch: <strong className="text-foreground">{traceData.batch.batchNumber}</strong>
              </span>
            )}
          </div>
          
          {isLoadingTrace ? (
            <div className="py-12 text-center text-muted-foreground">Memuat trace data...</div>
          ) : isErrorTrace ? (
            <div className="py-12 text-center text-destructive">Gagal memuat jejak material.</div>
          ) : traceData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Batch Info */}
              <Card className="md:col-span-3 border-primary/20 bg-primary/5">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="bg-background p-3 rounded-full border border-primary/20">
                    <Box className="w-6 h-6 text-primary" />
                  </div>
                  <div className="w-full">
                    <div className="flex justify-between items-start">
                      <h3 className="font-display font-bold text-lg mb-1">{traceData.batch.batchNumber}</h3>
                      <Badge variant={
                        traceData.batch.inspectionStatus === "approved" ? "success" : 
                        traceData.batch.inspectionStatus === "rejected" ? "destructive" : "warning"
                      }>
                        {traceData.batch.inspectionStatus.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 border-t border-primary/10 pt-4">
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase font-mono">Supplier</span>
                        <span className="font-medium">{traceData.batch.supplier}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase font-mono">Total Qty</span>
                        <span className="font-medium">{traceData.batch.quantity} {traceData.batch.unit}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase font-mono">Tgl Terima</span>
                        <span className="font-medium">{format(new Date(traceData.batch.deliveryDate), "dd MMM yyyy")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase font-mono">Penerima</span>
                        <span className="font-medium">{traceData.batch.receivedBy || '-'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Storage Locations */}
              <Card className="md:col-span-1 border-l-4 border-l-blue-500 flex flex-col">
                <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-500" /> Lokasi Gudang
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsInventoryModalOpen(true)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-4 flex-1">
                  {traceData.inventory.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Belum ada data penempatan</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {traceData.inventory.map(inv => {
                        const loc = locations.find(l => l.id === inv.storageLocationId);
                        return (
                          <div key={inv.id} className="bg-muted/30 p-3 rounded-md border border-border">
                            <div className="font-medium text-sm">{loc?.name || 'Lokasi Tidak Diketahui'}</div>
                            <div className="flex justify-between items-center mt-2 text-xs">
                              <span className="text-muted-foreground font-mono">Stok di lokasi</span>
                              <Badge variant="secondary">{inv.quantity} {traceData.batch.unit}</Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Usage / Installations */}
              <Card className="md:col-span-2 border-l-4 border-l-emerald-500">
                <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> Riwayat Pemakaian
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsUsageModalOpen(true)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {traceData.usage.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Belum ada data pemakaian/pemasangan</p>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/30 text-xs">
                        <TableRow>
                          <TableHead>Lokasi Pemasangan</TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Pelaksana</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {traceData.usage.map(usage => (
                          <TableRow key={usage.id}>
                            <TableCell className="font-medium text-sm">{usage.location}</TableCell>
                            <TableCell className="text-sm">{format(new Date(usage.installedDate), "dd MMM yyyy")}</TableCell>
                            <TableCell className="text-sm">{usage.installedBy}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{usage.quantity} {traceData.batch.unit}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">Trace data not found.</div>
          )}
        </TabsContent>

        {/* TAB: RECALL IMPACT */}
        <TabsContent value="recall" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => setActiveTab("batches")}>Kembali</Button>
          </div>
          
          {isLoadingRecall ? (
            <div className="py-12 text-center text-muted-foreground">Memuat impact analysis...</div>
          ) : isErrorRecall ? (
            <div className="py-12 text-center text-destructive">Gagal memuat analisis dampak.</div>
          ) : recallData ? (
            <Card className="border-destructive/30 overflow-hidden">
              <div className="bg-destructive/10 px-6 py-4 flex items-start gap-4 border-b border-destructive/20">
                <AlertTriangle className="w-8 h-8 text-destructive flex-shrink-0" />
                <div>
                  <h3 className="font-display font-bold text-xl text-destructive">Recall Impact Analysis</h3>
                  <p className="text-sm mt-1 text-destructive/80">
                    Analisis area terdampak jika batch <strong className="font-mono text-destructive">{recallData.batchId}</strong> terbukti cacat mutu dan harus direcall/dibongkar.
                  </p>
                </div>
              </div>
              <CardContent className="p-0">
                <div className="p-6 flex items-center justify-between border-b border-border bg-card">
                  <div>
                    <div className="text-xs uppercase font-mono text-muted-foreground mb-1">Total Lokasi Terdampak</div>
                    <div className="text-3xl font-display font-bold">{recallData.totalAffectedLocations}</div>
                  </div>
                  <Button variant="destructive" disabled={recallData.totalAffectedLocations === 0}>
                    Terbitkan NCR
                  </Button>
                </div>
                
                {recallData.locations.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Lokasi Pemasangan</TableHead>
                        <TableHead>Tanggal Pemasangan</TableHead>
                        <TableHead>Inspeksi Terkait</TableHead>
                        <TableHead className="text-right">Qty Terpasang</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recallData.locations.map((loc, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{loc.location}</TableCell>
                          <TableCell>{format(new Date(loc.installedDate), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            {loc.inspectionId ? (
                              <Badge variant="outline" className="font-mono">{loc.inspectionId.substring(0, 8)}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">Belum diinspeksi</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive font-bold">
                            {loc.quantity}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    Tidak ada area yang terdampak oleh batch ini (belum ada pemakaian).
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
             <div className="py-12 text-center text-muted-foreground">Impact data not found.</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals Master Data */}
      <CreateTypeModal isOpen={isCreateTypeModalOpen} onClose={() => setIsCreateTypeModalOpen(false)} />
      <CreateLocationModal isOpen={isCreateLocModalOpen} onClose={() => setIsCreateLocModalOpen(false)} />
      
      {/* Modal Batches & Trace */}
      <CreateBatchModal 
        isOpen={isCreateBatchModalOpen} 
        onClose={() => setIsCreateBatchModalOpen(false)} 
        types={types}
      />
      <InventoryModal 
        isOpen={isInventoryModalOpen} 
        onClose={() => setIsInventoryModalOpen(false)} 
        batchId={selectedBatchId || ""} 
        locations={locations}
      />
      <UsageModal 
        isOpen={isUsageModalOpen} 
        onClose={() => setIsUsageModalOpen(false)} 
        batchId={selectedBatchId || ""} 
      />
    </div>
  );
}

// --- MODAL COMPONENTS ---

function CreateTypeModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const queryClient = useQueryClient();
  const createType = useCreateMaterialType();
  
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");

  const resetForm = () => { setName(""); setCategory(""); setUnit(""); };

  const handleSave = () => {
    if (!name || !category || !unit) return;
    createType.mutate(
      { data: { name, category, unit } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMaterialTypesQueryKey() });
          resetForm();
          onClose();
        }
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Tambah Master Material">
      <div className="space-y-4">
        {createType.isError && (
          <div className="text-destructive text-sm bg-destructive/10 p-2 rounded border border-destructive/20">
            Gagal menyimpan data master material.
          </div>
        )}
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Nama Material</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mis. Besi Ulir D16" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Kategori</label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Mis. Rebar" />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Satuan (Unit)</label>
            <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Mis. kg, btg, m3" />
          </div>
        </div>
        <div className="pt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { resetForm(); onClose(); }}>Batal</Button>
          <Button onClick={handleSave} disabled={createType.isPending || !name || !category || !unit}>
            {createType.isPending ? "Menyimpan..." : "Simpan Material"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateLocationModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const queryClient = useQueryClient();
  const createLoc = useCreateMaterialLocation();
  
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const resetForm = () => { setName(""); setDesc(""); };

  const handleSave = () => {
    if (!name) return;
    createLoc.mutate(
      { data: { name, description: desc } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMaterialLocationsQueryKey() });
          resetForm();
          onClose();
        }
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Tambah Lokasi Gudang">
      <div className="space-y-4">
        {createLoc.isError && (
          <div className="text-destructive text-sm bg-destructive/10 p-2 rounded border border-destructive/20">
            Gagal menyimpan lokasi gudang.
          </div>
        )}
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Nama Lokasi</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mis. Gudang Utama A" />
        </div>
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Deskripsi (Opsional)</label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Mis. Penyimpanan material khusus cuaca" />
        </div>
        <div className="pt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { resetForm(); onClose(); }}>Batal</Button>
          <Button onClick={handleSave} disabled={createLoc.isPending || !name}>
            {createLoc.isPending ? "Menyimpan..." : "Simpan Lokasi"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateBatchModal({ isOpen, onClose, types }: { isOpen: boolean, onClose: () => void, types: any[] }) {
  const queryClient = useQueryClient();
  const createBatch = useCreateMaterialBatch();
  
  const [typeId, setTypeId] = useState("");
  const [batchNum, setBatchNum] = useState("");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [qty, setQty] = useState("");
  const [status, setStatus] = useState<"pending"|"approved"|"rejected">("pending");

  const resetForm = () => {
    setTypeId(""); setBatchNum(""); setSupplier("");
    setDate(new Date().toISOString().split('T')[0]);
    setQty(""); setStatus("pending");
  };

  const selectedType = types.find(t => t.id === typeId);

  const handleSave = () => {
    if (!typeId || !batchNum || !supplier || !date || !qty || !selectedType) return;
    createBatch.mutate(
      { 
        data: { 
          materialTypeId: typeId,
          batchNumber: batchNum,
          supplier: supplier,
          deliveryDate: new Date(date).toISOString(),
          quantity: Number(qty),
          unit: selectedType.unit, // inherit unit from master
          inspectionStatus: status
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMaterialBatchesQueryKey() });
          resetForm();
          onClose();
        }
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Terima Batch Material">
      <div className="space-y-4">
        {createBatch.isError && (
          <div className="text-destructive text-sm bg-destructive/10 p-2 rounded border border-destructive/20">
            Gagal merekam batch material.
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Tipe Material (Master)</label>
            <select 
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={typeId} onChange={e => setTypeId(e.target.value)}
            >
              <option value="" disabled>Pilih Material</option>
              {types.map(t => (
                <option key={t.id} value={t.id} className="bg-background">{t.name} ({t.unit})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">No Batch / DO</label>
            <Input value={batchNum} onChange={e => setBatchNum(e.target.value)} placeholder="Mis. DO-12345" />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Supplier</label>
            <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nama Pabrik/Toko" />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Tanggal Datang</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Kuantitas {selectedType ? `(${selectedType.unit})` : ""}</label>
            <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Status QA Awal</label>
            <select 
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={status} onChange={e => setStatus(e.target.value as any)}
            >
              <option value="pending" className="bg-background text-foreground">PENDING (Menunggu Inspeksi)</option>
              <option value="approved" className="bg-background text-green-500">APPROVED (Diterima)</option>
              <option value="rejected" className="bg-background text-destructive">REJECTED (Ditolak)</option>
            </select>
          </div>
        </div>
        <div className="pt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { resetForm(); onClose(); }}>Batal</Button>
          <Button onClick={handleSave} disabled={createBatch.isPending || !typeId || !batchNum || !supplier || !qty}>
            {createBatch.isPending ? "Merekam..." : "Rekam Kedatangan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function InventoryModal({ isOpen, onClose, batchId, locations }: { isOpen: boolean, onClose: () => void, batchId: string, locations: any[] }) {
  const queryClient = useQueryClient();
  const placeInventory = usePlaceMaterialInventory();
  
  const [locId, setLocId] = useState("");
  const [qty, setQty] = useState("");

  const resetForm = () => { setLocId(""); setQty(""); };

  const handleSave = () => {
    if (!locId || !qty || !batchId) return;
    placeInventory.mutate(
      { data: { batchId, storageLocationId: locId, quantity: Number(qty) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMaterialBatchTraceQueryKey(batchId) });
          resetForm();
          onClose();
        }
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Tempatkan ke Gudang">
      <div className="space-y-4">
        {placeInventory.isError && (
          <div className="text-destructive text-sm bg-destructive/10 p-2 rounded border border-destructive/20">
            Gagal menyimpan data penempatan.
          </div>
        )}
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Lokasi Gudang/Area</label>
          <select 
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={locId} onChange={e => setLocId(e.target.value)}
          >
            <option value="" disabled>Pilih lokasi</option>
            {locations.map(l => (
              <option key={l.id} value={l.id} className="bg-background">{l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Kuantitas</label>
          <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
        </div>
        <div className="pt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { resetForm(); onClose(); }}>Batal</Button>
          <Button onClick={handleSave} disabled={placeInventory.isPending || !locId || !qty}>
            {placeInventory.isPending ? "Menyimpan..." : "Simpan Lokasi"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function UsageModal({ isOpen, onClose, batchId }: { isOpen: boolean, onClose: () => void, batchId: string }) {
  const queryClient = useQueryClient();
  const recordUsage = useRecordMaterialUsage();
  
  const [loc, setLoc] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const resetForm = () => { setLoc(""); setQty(""); setDate(new Date().toISOString().split('T')[0]); };

  const handleSave = () => {
    if (!loc || !qty || !batchId || !date) return;
    recordUsage.mutate(
      { data: { batchId, location: loc, quantity: Number(qty), installedDate: new Date(date).toISOString() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMaterialBatchTraceQueryKey(batchId) });
          queryClient.invalidateQueries({ queryKey: getGetMaterialBatchRecallQueryKey(batchId) });
          resetForm();
          onClose();
        }
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Rekam Pemasangan Material">
      <div className="space-y-4">
        {recordUsage.isError && (
          <div className="text-destructive text-sm bg-destructive/10 p-2 rounded border border-destructive/20">
            Gagal merekam data pemasangan.
          </div>
        )}
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Lokasi Pemasangan (Proyek)</label>
          <Input value={loc} onChange={e => setLoc(e.target.value)} placeholder="Mis. Zona A, Lantai 2 Kolom K1" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Tanggal Pasang</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Kuantitas Terpasang</label>
            <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="pt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { resetForm(); onClose(); }}>Batal</Button>
          <Button onClick={handleSave} disabled={recordUsage.isPending || !loc || !qty}>
            {recordUsage.isPending ? "Merekam..." : "Rekam Pemasangan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
