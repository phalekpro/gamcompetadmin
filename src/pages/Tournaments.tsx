import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, serverTimestamp, deleteDoc, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Tournament } from '../types';
import toast from 'react-hot-toast';
import { Plus, Trash2, Play, CheckCircle, Upload, X, Eye, Shuffle, Users, Trophy, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createEmptyBracket } from '../utils/bracketUtils';
import { SUPPORTED_GAMES, getGamePreset, type GamePreset } from '../config/gamePresets';

export default function Tournaments() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tournamentType, setTournamentType] = useState<'classic' | 'championship'>('classic');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<GamePreset | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    game: '',
    gameId: '',
    entryFee: 1500,
    firstPrize: 0,
    secondPrize: 0,
    thirdPrize: 0,
    maxParticipants: 32,
    registrationDeadline: '',
    startDate: '',
    description: '',
    rules: '',
    isPaid: true,
    paymentLink: '',
    mode: '',
    roomId: '',
    // Champs championnat
    duration: 30,
    maxMatchesPerPlayer: 30,
    maxMatchesVsOpponent: 10,
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
  });

  // Quand un preset jeu est sélectionné, remplir les valeurs par défaut
  const applyGamePreset = (gameId: string) => {
    const preset = getGamePreset(gameId);
    if (!preset) { setSelectedPreset(null); return; }
    setSelectedPreset(preset);
    setFormData(prev => ({
      ...prev,
      game: preset.name,
      gameId: preset.id,
      mode: preset.defaultMode,
      entryFee: preset.defaultEntryFee,
      maxParticipants: preset.defaultMaxPlayers,
      maxMatchesPerPlayer: preset.defaultMaxMatchesPerPlayer,
      maxMatchesVsOpponent: preset.defaultMaxMatchesVsOpponent,
      pointsWin: preset.defaultPointsSystem.win,
      pointsDraw: preset.defaultPointsSystem.draw,
      pointsLoss: preset.defaultPointsSystem.loss,
      rules: preset.rules.join('\n'),
    }));
  };

  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const q = query(
        collection(db, 'tournaments'), 
        orderBy('startDate', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const tournamentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Tournament));
      setTournaments(tournamentsData);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier la taille (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image trop volumineuse (max 5MB)');
        return;
      }

      // Vérifier le type
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner une image');
        return;
      }

      setImageFile(file);

      // Créer un aperçu
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      setUploading(true);
      const timestamp = Date.now();
      const fileName = `tournaments/${timestamp}_${imageFile.name}`;
      const storageRef = ref(storage, fileName);

      await uploadBytes(storageRef, imageFile);
      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erreur lors de l\'upload de l\'image');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTournament) return;

    try {
      setLoading(true);
      const updates: any = {
        startDate: new Date(editingTournament.startDate),
        registrationDeadline: new Date(editingTournament.registrationDeadline),
        roomId: editingTournament.roomId || '',
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'tournaments', editingTournament.id), updates);
      toast.success('Tournoi mis à jour');
      setEditingTournament(null);
      fetchTournaments();
    } catch (error) {
      console.error('Error updating tournament:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      let imageUrl = '';
      if (imageFile) {
        const url = await uploadImage();
        if (url) imageUrl = url;
      }

      const startDateObj = new Date(formData.startDate);

      if (tournamentType === 'championship') {
        // Calculer les dates automatiques
        const endDate = new Date(startDateObj);
        endDate.setDate(endDate.getDate() + formData.duration);
        const registrationCloseDate = new Date(startDateObj);
        registrationCloseDate.setDate(registrationCloseDate.getDate() + 20);

        await addDoc(collection(db, 'tournaments'), {
          name: formData.name,
          game: formData.game,
          gameId: formData.gameId,
          mode: formData.mode,
          type: 'championship',
          entryFee: formData.entryFee,
          isPaid: formData.isPaid,
          paymentLink: formData.paymentLink,
          imageUrl,
          currentParticipants: 0,
          maxParticipants: formData.maxParticipants,
          status: 'open',
          participants: [],
          description: formData.description,
          rules: formData.rules,
          startDate: startDateObj,
          endDate,
          registrationDeadline: registrationCloseDate,
          registrationCloseDate,
          duration: formData.duration,
          maxMatchesPerPlayer: formData.maxMatchesPerPlayer,
          maxMatchesVsOpponent: formData.maxMatchesVsOpponent,
          pointsSystem: {
            win: formData.pointsWin,
            draw: formData.pointsDraw,
            loss: formData.pointsLoss,
          },
          prizeDistribution: {
            positions: [
              { rank: 1, percentage: 50, label: '1er' },
              { rank: 2, percentage: 30, label: '2ème' },
              { rank: 3, percentage: 20, label: '3ème' },
            ]
          },
          matchmakingDoneChampionship: false,
          firstPrize: formData.firstPrize,
          secondPrize: formData.secondPrize,
          thirdPrize: formData.thirdPrize,
          createdAt: serverTimestamp(),
        });
        toast.success('🏆 Championnat créé avec succès !');
      } else {
        const emptyBracket = createEmptyBracket(formData.maxParticipants);
        await addDoc(collection(db, 'tournaments'), {
          ...formData,
          type: 'classic',
          imageUrl,
          currentParticipants: 0,
          status: 'open',
          participants: [],
          bracket: emptyBracket,
          registrationDeadline: formData.registrationDeadline ? new Date(formData.registrationDeadline) : null,
          startDate: startDateObj,
          createdAt: serverTimestamp(),
        });
        toast.success('Tournoi créé avec succès');
      }

      setShowModal(false);
      fetchTournaments();
      setFormData({ name: '', game: '', gameId: '', entryFee: 1500, firstPrize: 0, secondPrize: 0, thirdPrize: 0, mode: '', roomId: '', maxParticipants: 32, registrationDeadline: '', startDate: '', description: '', rules: '', isPaid: true, paymentLink: '', duration: 30, maxMatchesPerPlayer: 30, maxMatchesVsOpponent: 10, pointsWin: 3, pointsDraw: 1, pointsLoss: 0 });
      setTournamentType('classic');
      setSelectedPreset(null);
      setImageFile(null);
      setImagePreview('');
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (tournamentId: string, newStatus: Tournament['status']) => {
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setTournaments(tournaments.map(t =>
        t.id === tournamentId ? { ...t, status: newStatus } : t
      ));
      toast.success('Statut mis à jour');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteTournament = async (tournamentId: string, tournamentName: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le tournoi "${tournamentName}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      // Supprimer complètement le document du tournoi dans Firestore
      await deleteDoc(doc(db, 'tournaments', tournamentId));

      // Mettre à jour la liste locale
      setTournaments(tournaments.filter(t => t.id !== tournamentId));
      toast.success('Tournoi supprimé avec succès');
    } catch (error) {
      console.error('Error deleting tournament:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getStatusColor = (status: Tournament['status']) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tournois</h1>
          <p className="text-gray-500 mt-1">{tournaments.length} tournois au total</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Créer un tournoi
        </button>
      </div>

      {/* Tournaments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.map((tournament) => (
          <div key={tournament.id} className={`bg-white rounded-xl shadow-sm border p-6 ${
            tournament.type === 'championship' ? 'border-violet-200 ring-1 ring-violet-100' : 'border-gray-100'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{tournament.name}</h3>
                  {tournament.type === 'championship' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">🏆 Champ.</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{tournament.game}{tournament.mode ? ` - ${tournament.mode}` : ''}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(tournament.status)}`}>
                {tournament.status}
              </span>
              {tournament.isPaid && (
                <span className="px-3 py-1 ml-2 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Payant
                </span>
              )}
              {!tournament.isPaid && (
                <span className="px-3 py-1 ml-2 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Gratuit
                </span>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Frais d'entrée</span>
                <span className="font-medium">{tournament.entryFee} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">🥇 1er Prix</span>
                <span className="font-medium text-yellow-600">{tournament.firstPrize?.toLocaleString() || 0} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">🥈 2ème Prix</span>
                <span className="font-medium text-gray-500">{tournament.secondPrize?.toLocaleString() || 0} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">🥉 3ème Prix</span>
                <span className="font-medium text-orange-600">{tournament.thirdPrize?.toLocaleString() || 0} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Participants</span>
                <span className="font-medium">{tournament.participants?.length || 0}/{tournament.maxParticipants}</span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <>
                {/* Bouton Matchmaking Championnat */}
                {tournament.type === 'championship' && (
                  <button
                    onClick={() => navigate(`/championships/${tournament.id}`)}
                    className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    title="Gérer le championnat"
                  >
                    <Trophy className="w-4 h-4" />
                    Championnat
                  </button>
                )}
                {tournament.type === 'championship' && !tournament.matchmakingDoneChampionship && (
                  <button
                    onClick={() => navigate(`/championships/${tournament.id}/matchmaking`)}
                    className="flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    title="Générer les adversaires"
                  >
                    <Shuffle className="w-4 h-4" />
                    Matchmaking
                  </button>
                )}
                {/* Bouton Matchmaking Classique */}
                {(!tournament.type || tournament.type === 'classic') && (tournament.status === 'open' || tournament.status === 'in_progress') && tournament.mode !== 'Battle Royale' && (
                  <button
                    onClick={() => navigate(`/tournaments/${tournament.id}/matchmaking`)}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tournament.bracket?.matchMakingDone 
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                    title="Gérer le match making"
                  >
                    <Shuffle className="w-4 h-4" />
                    {tournament.bracket?.matchMakingDone ? 'Gérer Matchmaking' : 'Match Making'}
                  </button>
                )}
                {(tournament.status === 'in_progress' || tournament.status === 'completed') && tournament.mode !== 'Battle Royale' && (
                  <button
                    onClick={() => navigate(`/tournaments/${tournament.id}/bracket`)}
                    className="flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    title="Voir le bracket"
                  >
                    <Eye className="w-4 h-4" />
                    Bracket
                  </button>
                )}
                {tournament.status === 'open' && (
                  <button
                    onClick={() => updateStatus(tournament.id, 'in_progress')}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Démarrer
                  </button>
                )}
                {tournament.status === 'in_progress' && (
                  <button
                    onClick={() => updateStatus(tournament.id, 'completed')}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Terminer
                  </button>
                )}
                <button
                  onClick={() => navigate(`/tournaments/${tournament.id}/participants`)}
                  className="flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  title="Voir les participants"
                >
                  <Users className="w-4 h-4" />
                  Participants
                </button>
                <button
                  onClick={() => setEditingTournament(tournament)}
                  className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  title="Modifier les infos"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Infos
                </button>
                <button
                  onClick={() => deleteTournament(tournament.id, tournament.name)}
                  className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  title="Supprimer le tournoi"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {
        showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Créer un tournoi</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Sélecteur de type */}
              <div className="flex gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setTournamentType('classic')}
                  className={`flex-1 flex items-center gap-2 justify-center px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    tournamentType === 'classic'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Shuffle className="w-4 h-4" />
                  Tournoi classique
                </button>
                <button
                  type="button"
                  onClick={() => setTournamentType('championship')}
                  className={`flex-1 flex items-center gap-2 justify-center px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    tournamentType === 'championship'
                      ? 'border-violet-600 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  Championnat 30 jours
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image du tournoi
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors">
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="max-h-48 mx-auto rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview('');
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                          Cliquez pour uploader une image
                        </p>
                        <p className="text-xs text-gray-400">
                          PNG, JPG, WEBP (max 5MB)
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="tournament-image"
                    />
                    <label
                      htmlFor="tournament-image"
                      className="mt-2 inline-block px-4 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary/90"
                    >
                      Choisir une image
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jeu</label>
                  {tournamentType === 'championship' ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        {SUPPORTED_GAMES.map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyGamePreset(preset.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                              selectedPreset?.id === preset.id
                                ? 'border-violet-500 bg-violet-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-2xl">{preset.emoji}</span>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{preset.name}</p>
                              <p className="text-xs text-gray-400">{preset.description}</p>
                            </div>
                            {selectedPreset?.id === preset.id && (
                              <CheckCircle className="w-5 h-5 text-violet-600 ml-auto shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                      {selectedPreset && (
                        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                          <p className="text-sm font-semibold text-violet-800 mb-1">✅ Preset appliqué : {selectedPreset.name}</p>
                          <p className="text-xs text-violet-600">Modes disponibles : {selectedPreset.modes.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.game}
                      onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Sélectionner un jeu</option>
                      <option value="Clash Royale">Clash Royale</option>
                      <option value="Free Fire">Free Fire</option>
                      <option value="Call of Duty Mobile">Call of Duty Mobile</option>
                      <option value="Rocket League">Rocket League</option>
                      <option value="eFootball">eFootball</option>
                    </select>
                  )}
                </div>

                {formData.game === 'Call of Duty Mobile' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                    <select
                      required
                      value={formData.mode}
                      onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Sélectionner un mode</option>
                      <option value="Battle Royale">Battle Royale</option>
                      <option value="MJ">MJ (Multijoueur)</option>
                    </select>
                  </div>
                )}

                {formData.mode === 'Battle Royale' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID du Salon (Room ID)</label>
                    <input
                      type="text"
                      value={formData.roomId}
                      onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                      placeholder="Identifiant ou code du salon"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Décrivez le tournoi..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Règlement */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Règlement</label>
                  <textarea
                    value={formData.rules}
                    onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                    rows={4}
                    placeholder="Règles du tournoi..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-3 mb-2">
                  <input
                    type="checkbox"
                    id="isPaid"
                    checked={formData.isPaid}
                    onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="isPaid" className="text-sm font-medium text-gray-700">
                    Tournoi payant ?
                  </label>
                </div>

                {formData.isPaid && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lien de paiement Wave</label>
                    <input
                      type="url"
                      required={formData.isPaid}
                      value={formData.paymentLink}
                      onChange={(e) => setFormData({ ...formData, paymentLink: e.target.value })}
                      placeholder="https://pay.wave.com/m/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Lien vers lequel les utilisateurs seront redirigés pour payer</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frais (FCFA)</label>
                    <input
                      type="number"
                      required
                      value={formData.entryFee}
                      onChange={(e) => setFormData({ ...formData, entryFee: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Participants</label>
                    <select
                      value={formData.maxParticipants}
                      onChange={(e) => setFormData({ ...formData, maxParticipants: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value={8}>8</option>
                      <option value={16}>16</option>
                      <option value={32}>32</option>
                      <option value={64}>64</option>
                      <option value={100}>100 (Battle Royale)</option>
                      <option value={128}>128</option>
                      <option value={256}>256</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix 1er 🥇</label>
                    <input
                      type="number"
                      required
                      value={formData.firstPrize}
                      onChange={(e) => setFormData({ ...formData, firstPrize: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix 2ème 🥈</label>
                    <input
                      type="number"
                      required
                      value={formData.secondPrize}
                      onChange={(e) => setFormData({ ...formData, secondPrize: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix 3ème 🥉</label>
                    <input
                      type="number"
                      required
                      value={formData.thirdPrize}
                      onChange={(e) => setFormData({ ...formData, thirdPrize: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {tournamentType === 'classic' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date limite inscription</label>
                    <input
                      type="datetime-local"
                      value={formData.registrationDeadline}
                      onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                )}

                {tournamentType === 'championship' && (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-600" />
                      <h4 className="font-semibold text-violet-800 text-sm">Paramètres du championnat</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Durée (jours)</label>
                        <input type="number" min={7} max={90} value={formData.duration}
                          onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Max matchs / joueur</label>
                        <input type="number" min={5} max={100} value={formData.maxMatchesPerPlayer}
                          onChange={e => setFormData({ ...formData, maxMatchesPerPlayer: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Max matchs vs même joueur</label>
                        <input type="number" min={1} max={20} value={formData.maxMatchesVsOpponent}
                          onChange={e => setFormData({ ...formData, maxMatchesVsOpponent: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Points (V / N / D)</label>
                        <div className="flex gap-1">
                          <input type="number" min={0} max={10} value={formData.pointsWin}
                            onChange={e => setFormData({ ...formData, pointsWin: Number(e.target.value) })}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-violet-300"
                            placeholder="V"
                          />
                          <input type="number" min={0} max={10} value={formData.pointsDraw}
                            onChange={e => setFormData({ ...formData, pointsDraw: Number(e.target.value) })}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-violet-300"
                            placeholder="N"
                          />
                          <input type="number" min={0} max={10} value={formData.pointsLoss}
                            onChange={e => setFormData({ ...formData, pointsLoss: Number(e.target.value) })}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-violet-300"
                            placeholder="D"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-violet-600">📅 Date de fin et clôture inscriptions (jour 20) calculées automatiquement.</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || loading}
                    className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Upload...' : loading ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Edit Modal (Date, Time, Room ID) */}
      {editingTournament && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Programmer le tournoi</h2>
            <form onSubmit={handleUpdateTournament} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                <input
                  type="datetime-local"
                  required
                  value={editingTournament.startDate ? new Date(editingTournament.startDate.seconds ? editingTournament.startDate.seconds * 1000 : editingTournament.startDate).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditingTournament({ ...editingTournament, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date limite d'inscription</label>
                <input
                  type="datetime-local"
                  required
                  value={editingTournament.registrationDeadline ? new Date(editingTournament.registrationDeadline.seconds ? editingTournament.registrationDeadline.seconds * 1000 : editingTournament.registrationDeadline).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditingTournament({ ...editingTournament, registrationDeadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {editingTournament.mode === 'Battle Royale' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID du Salon</label>
                  <input
                    type="text"
                    value={editingTournament.roomId || ''}
                    onChange={(e) => setEditingTournament({ ...editingTournament, roomId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Saisir quand prêt..."
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingTournament(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium"
                >
                  {loading ? 'Mise à jour...' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div >
  );
}
