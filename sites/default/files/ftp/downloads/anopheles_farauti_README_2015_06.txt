**README************************************************************************
In VectorBase release 1506, Anopheles farauti genes were projected from 
assembly version 1 (GCA_000473445.1) to assembly version 2 (GCA_000473445.2). 
This README file describes the projection methodology, resources for 
reinstating unprojected genes, and explains the contents of the other files in 
this directory.


**Gene Projection Methodology***************************************************
The projection is based on an alignment of the assembly versions, using ATAC 
(http://seqanswers.com/wiki/ATAC), which provides a mapping between regions of 
the old and new assemblies. This mapping is used to project each exon 
separately; these are then combined to produce a projected transcript.

Sometimes, UTRs are truncated when projected to the new assembly; in these 
cases, only the CDS regions are projected, and the projected transcript has no 
UTRs (since it is not necessarily the case that a truncated UTR will be valid).

Projection can fail by:
 * generating a translation with internal stop codons. This is most likely due 
   to a nucleotide change(s) in the underlying assembly.
 * mapping from one scaffold in the old assembly to multiple scaffolds (or 
   strands) in the new assembly.
 * mapping partially (with either truncated CDS regions or missing exons)
 * not mapping at all

For the last two cases it is feasible to attempt an alignment of the coding DNA 
sequence against the new assembly, using Exonerate 
(https://www.ebi.ac.uk/~guy/exonerate), in order to cover any regions where the 
ATAC alignment failed to produce a mapping. In practice, the ATAC alignment is 
usually very good, and only 12 transcripts are automatically reinstated via 
Exonerate alignments.


**Reinstating Unprojected Genes*************************************************
In many cases there are good reasons for a transcript failing to project, but 
some transcripts with good evidence can be lost; our automated procedures try 
to minimise this latter set, but it is inevitable that some will need a small 
amount of manual correction. To facilitate this, we calculate statistics to 
show the quality and quantity of evidence for unprojected transcripts, in the 
'report.txt' file in this directory. Further, transcripts which we consider to 
have "good" evidence in the old assembly (of which there are 94) are stored in 
the 'unresolved_transcripts.txt' file (see the file description below for criteria).

For unprojected transcripts that map at least partially, the mappings are 
available in GFF3 format, and are also presented as a track in WebApollo. 
If transcripts map to multiple scaffolds (or strands), the GFF file has 
separate genes for each scaffold, using the original ID with a numeric suffix.

For all unprojected transcripts there are a range of FASTA files that have the 
original transcript's sequence, for BLASTing or otherwise searching on the new 
assembly. Note that the reason for the projection failure is included in the 
FASTA header.

For completeness, we provide the GFF3 and FASTA files for projected transcripts 
as well, but these are probably not as useful as those for unprojected 
transcripts.


**Files in this Directory*******************************************************

--unresolved_transcripts.txt----------------------------------------------------------
The stable IDs of unprojected transcripts which fulfill the following criteria, 
and thus represented credible genes on the old assembly:
 * protein_features > 0
 * orthologs > 1
 * paralogs_projected = 0
 * duplicates_projected = 0
 * overlapping_projected = 0

--projected_cdna.fa-------------------------------------------------------------
cDNA sequence (from the old assembly) of projected transcripts.

--projected_cds.fa--------------------------------------------------------------
Coding sequence (from the old assembly) of projected transcripts.

--projected.gff3----------------------------------------------------------------
Projected transcripts (coordinates on the new assembly) in GFF3 format.

--projected_pep.fa--------------------------------------------------------------
Peptide sequence (from the old assembly) of projected transcripts.

--report.txt--------------------------------------------------------------------
Description of the fate of every transcript in the old assembly, along with 
statistics to judge the quality and quantity of evidence.
Columns:
 * transcript: stable ID
 * status: result of projection
 * biotype: type of gene, e.g. protein_coding, miRNA
 * cdna_length: the sum of exon lengths
 * coding_length: the sum of CDS lengths
 * exons: number of exons in the transcript
 * cds: number of CDS regions in the transcript
 * protein_features: number of protein domains annotated by InterProScan
 * exon_complete: number of exons that map in their entirety
 * exon_partial: number of exons that map partially
 * exon_missing: number of exons that do not map at all 
 * exon_locations: number of different scaffolds/strands to which exons map
 * cds_complete: number of CDS regions that map in their entirety
 * cds_partial: number of CDS regions that map partially
 * cds_missing: number of CDS regions that do not map at all 
 * cds_locations: number of different scaffolds/strands to which CDS regions map
 * cds_translates: 1 if the CDS produce a valid translation, 0 otherwise
 * orthologs: number of orthologs (in VectorBase release 1504)
 * paralogs: number of paralogs (in VectorBase release 1504)
 * paralogs_projected: number of paralogs that are projected
 * paralogs_list: a list of stable IDs of the paralogs, suffixed with ':1' if 
   the paralog is projected, 0 otherwise
 * gene_split: number of genes that have a 'split' relationship with the 
   transcript. (Comparative analysis infers that an ancestral gene split into 
   two or more genes, and that the ancestral gene is inferred to be homologous 
   to other, unsplit, genes.)
 * gene_split_projected: number of split genes that are projected
 * gene_split_list:a list of stable IDs of the split genes, suffixed with ':1' 
   if the split gene is projected, 0 otherwise
 * duplicates: number of transcripts with identical nucleotide sequence in CDS 
   regions
 * duplicates_projected: number of duplicates that are projected
 * duplicates_list: a list of stable IDs of the duplicates, suffixed with ':1' 
   if the duplicate is projected, 0 otherwise
 * overlapping: number of transcripts that overlap (on either strand)
 * overlapping_projected: number of overlapping transcripts that are projected
 * overlapping_list: a list of stable IDs of the overlapping transcripts, 
   suffixed with ':1' if the overlapping transcript is projected, 0 otherwise

--summary.txt-------------------------------------------------------------------
A summary of the number of transcripts that could and could not be projected.

--unprojected_cdna.fa-----------------------------------------------------------
cDNA sequence (from the old assembly) of unprojected transcripts.

--unprojected_cds.fa------------------------------------------------------------
Coding sequence (from the old assembly) of unprojected transcripts.

--unprojected.gff3--------------------------------------------------------------
Unrojected (but partially mapped) transcripts (coordinates on the new assembly) 
in GFF3 format.

--unprojected_pep.fa------------------------------------------------------------
Peptide sequence (from the old assembly) of unprojected transcripts.

